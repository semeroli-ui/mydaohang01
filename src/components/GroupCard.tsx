import React, { useState, useEffect } from 'react';
import { Site, Group } from '../API/http';
import SiteCard from './SiteCard';
import { GroupWithSites } from '../types';
import EditGroupDialog from './EditGroupDialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
// 引入Material UI组件
import {
  Paper,
  Typography,
  Button,
  Box,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Collapse,
  useMediaQuery,
} from '@mui/material';
import SortIcon from '@mui/icons-material/Sort';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { alpha } from '@mui/material/styles';
import { RADIUS, FONT_SIZE } from '../theme';

/**
 * 把「主名（说明）」拆成两段。
 *
 * 起因：手机上 24 个分组里有 15 个标题要换 2~3 行，最长的那个吃掉 89px，
 * 而括号里那串其实是「这个组里有什么」的说明，不是分组的身份 ——
 * 两者字号一样时，标题读起来像一段正文。
 *
 * 拆开之后手机端的层级是：主名（22px/600，一行）→ 说明（13px/次级色，最多两行）
 * → 数量（常显，不参与截断）。桌面上所有组名本来都是一行，保持原样不动。
 *
 * 拿不到括号就整串当主名原样返回，不做任何猜测；
 * 括号里是空的、或者主名是空的（比如组名就叫「（备注）」）也原样返回。
 */
function splitGroupName(name: string): { main: string; note: string } {
  const m = name.match(/^(.+?)[（(](.+)[）)]\s*$/);
  if (!m || !m[1]?.trim() || !m[2]?.trim()) return { main: name, note: '' };
  return { main: m[1].trim(), note: m[2].trim() };
}

// 与 App.css 里的移动端断点（max-width: 600px）对齐
const MOBILE_QUERY = '(max-width: 599.95px)';

// 卡片网格：编辑态与只读态共用这一份定义。
// 原来是 flex-wrap + 百分比列宽，两处各写一套（md 一个 25%、一个 33.33%），
// 且列数被断点锁死 —— 1440px 下固定 4 列、右边空一大片。
// 换成 auto-fill 之后列数由可用宽度自己算，铺满为止，永不跳空。
//
// 最小宽度 220 而不是 190：拿线上 204 张真实卡片量过，
// 190/200 在 1440 下排 6 列、卡宽 208，有 23 个站名被省略号截断；
// 210~240 排 5 列、卡宽 252，截断降到 5 个；260 退回 4 列只剩 1 个但开始浪费宽度。
const CARD_GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 2, // 16px，与分组内边距同一倍数
} as const;

// 更新组件属性接口
interface GroupCardProps {
  group: GroupWithSites;
  index?: number; // 用于Draggable的索引，仅在分组排序模式下需要
  sortMode: 'None' | 'GroupSort' | 'SiteSort';
  currentSortingGroupId: number | null;
  viewMode?: 'readonly' | 'edit'; // 访问模式
  onUpdate: (updatedSite: Site) => void;
  onDelete: (siteId: number) => void;
  onSaveSiteOrder: (groupId: number, sites: Site[]) => void;
  onStartSiteSort: (groupId: number) => void;
  onAddSite?: (groupId: number) => void; // 新增添加卡片的可选回调函数
  onUpdateGroup?: (group: Group) => void; // 更新分组的回调函数
  onDeleteGroup?: (groupId: number) => void; // 删除分组的回调函数
  configs?: Record<string, string>; // 传入配置
}

const GroupCard: React.FC<GroupCardProps> = ({
  group,
  sortMode,
  currentSortingGroupId,
  viewMode = 'edit', // 默认为编辑模式
  onUpdate,
  onDelete,
  onSaveSiteOrder,
  onStartSiteSort,
  onAddSite,
  onUpdateGroup,
  onDeleteGroup,
  configs,
}) => {
  // 添加本地状态来管理站点排序
  const [sites, setSites] = useState<Site[]>(group.sites);
  // 添加编辑弹窗的状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  // 添加提示消息状态
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  // 添加折叠状态
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const savedState = localStorage.getItem(`group-${group.id}-collapsed`);
    return savedState ? JSON.parse(savedState) : false;
  });

  // 手机上把「主名 / 说明」拆成两级；桌面保持原来的一行
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const { main: groupMainName, note: groupNote } = splitGroupName(group.name);

  // 保存折叠状态到本地存储
  useEffect(() => {
    if (group.id) {
      localStorage.setItem(`group-${group.id}-collapsed`, JSON.stringify(isCollapsed));
    }
  }, [isCollapsed, group.id]);

  // 处理折叠切换
  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  // 配置传感器，支持鼠标、触摸和键盘操作
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px 的移动才激活拖拽，防止误触
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // 延迟250ms激活，防止误触
        tolerance: 5, // 容忍5px的移动
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 站点拖拽结束处理函数
  const handleSiteDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    if (active.id !== over.id) {
      // 查找拖拽的站点索引
      const oldIndex = sites.findIndex((site) => `site-${site.id}` === active.id);
      const newIndex = sites.findIndex((site) => `site-${site.id}` === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // 更新本地站点顺序
        const newSites = arrayMove(sites, oldIndex, newIndex);
        setSites(newSites);
      }
    }
  };

  // 编辑分组处理函数
  const handleEditClick = () => {
    setEditDialogOpen(true);
  };

  // 更新分组处理函数
  const handleUpdateGroup = (updatedGroup: Group) => {
    if (onUpdateGroup) {
      onUpdateGroup(updatedGroup);
      setEditDialogOpen(false);
    }
  };

  // 删除分组处理函数
  const handleDeleteGroup = (groupId: number) => {
    if (onDeleteGroup) {
      onDeleteGroup(groupId);
      setEditDialogOpen(false);
    }
  };

  // 判断是否为当前正在编辑的分组
  const isCurrentEditingGroup = sortMode === 'SiteSort' && currentSortingGroupId === group.id;

  // 排序模式下，非当前分组不再整体隐藏（会让人误以为数据丢失），改为淡出 + 禁用交互
  const isDimmed = !isCurrentEditingGroup && sortMode === 'SiteSort';

  // 渲染站点卡片区域
  const renderSites = () => {
    // 使用本地状态中的站点数据
    const sitesToRender = isCurrentEditingGroup ? sites : group.sites;
    const isSortable = isCurrentEditingGroup;

    // 只读态与编辑态渲染的是同一套网格，唯一差别是外层包不包拖拽上下文、
    // 以及传给 SiteCard 的 isEditMode。这样点「排序」卡片既不重排也不跳位。
    const grid = (
      <Box sx={CARD_GRID}>
        {sitesToRender.map((site, idx) => (
          <SiteCard
            key={site.id || idx}
            site={site}
            onUpdate={onUpdate}
            onDelete={onDelete}
            isEditMode={isSortable}
            viewMode={viewMode}
            index={idx}
            iconApi={configs?.['site.iconApi']} // 传入iconApi配置
          />
        ))}
      </Box>
    );

    if (!isSortable) {
      return grid;
    }

    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleSiteDragEnd}
      >
        <SortableContext
          items={sitesToRender.map((site) => `site-${site.id}`)}
          // 卡片已经换行成多行网格，horizontal 策略只认第一行；rect 策略按矩形位置找落点
          strategy={rectSortingStrategy}
        >
          {grid}
        </SortableContext>
      </DndContext>
    );
  };

  // 保存站点排序
  const handleSaveSiteOrder = () => {
    if (!group.id) {
      console.error('分组 ID 不存在,无法保存排序');
      return;
    }
    onSaveSiteOrder(group.id, sites);
  };

  // 处理排序按钮点击
  const handleSortClick = () => {
    if (!group.id) {
      console.error('分组 ID 不存在,无法开始排序');
      return;
    }
    if (group.sites.length < 2) {
      setSnackbarMessage('至少需要2个站点才能进行排序');
      setSnackbarOpen(true);
      return;
    }
    // 确保分组展开
    if (isCollapsed) {
      setIsCollapsed(false);
    }
    onStartSiteSort(group.id);
  };

  // 关闭提示消息
  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  // 修改分组标题区域的渲染
  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: RADIUS.surface,
        p: { xs: 2, sm: 3 },
        // 只过渡真正会变的两个属性。原来写 transition: all，连 transform 一起过渡，
        // hover 时整块分组会放大 1%、把邻居推开 —— 鼠标划过一排分组页面像在呼吸。
        transition: 'box-shadow 240ms ease-out, border-color 240ms ease-out',
        border: '1px solid transparent',
        // 1 / 5 是主题的三档阴影索引：静止 / 抬一级（见 src/theme.ts）
        boxShadow: sortMode === 'None' ? 1 : 5,
        // 排序时的非当前分组：淡出 + 禁止交互，但内容保留，避免用户误以为数据丢失
        opacity: isDimmed ? 0.4 : 1,
        pointerEvents: isDimmed ? 'none' : 'auto',
        '&:hover': {
          boxShadow: 5,
          borderColor: 'divider',
        },
        backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.95),
        backdropFilter: 'blur(5px)',
      }}
    >
      <Box
        display='flex'
        flexDirection={{ xs: 'column', sm: 'row' }}
        justifyContent='space-between'
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        mb={2.5}
        gap={1}
      >
        <Box
          sx={{
            display: 'flex',
            // 手机端标题变成「主名 + 说明」两行，箭头要对齐到主名那一行，
            // 而不是在两行之间的中线上悬浮（那会让人以为它属于说明那一行）。
            alignItems: { xs: 'flex-start', sm: 'center' },
            // 24px 图标按钮 + 4px 间距 = 28px，左移等量让标题文字与下方卡片左边缘落在同一条竖线上。
            // 但分组内边距在手机上只有 16px，减 28px 会把箭头推到卡片边框上（贴着边线，像脏点），
            // 所以窄屏放弃这根对齐线、让箭头待在留白里，标题自然缩进 28px —— 这是折叠面板的常规样子。
            ml: { xs: 0, sm: '-28px' },
            gap: 0.5,
            cursor: 'pointer',
            '&:hover': {
              '& .collapse-icon': {
                color: 'primary.main',
              },
            },
          }}
          onClick={handleToggleCollapse}
        >
          <IconButton
            size='small'
            className='collapse-icon'
            aria-label={isCollapsed ? `展开 ${group.name}` : `收起 ${group.name}`}
            aria-expanded={!isCollapsed}
            sx={{
              width: 24,
              height: 24,
              p: 0,
              // 主名行高 29.7px、图标 24px，补 3px 让箭头视觉上落在那一行的中线上
              mt: { xs: '3px', sm: 0 },
            }}
          >
            {/* 按「方向」表达状态，而不是上下翻转：
                收起时朝右「›」＝可以展开；展开时转 90° 朝下「⌄」＝内容在下方。
                上下翻转是 MUI Accordion 的习惯做法，但展开态朝上在本页容易被读成"回到顶部"。 */}
            <ChevronRightIcon
              sx={{
                fontSize: 20,
                transform: isCollapsed ? 'none' : 'rotate(90deg)',
                transition: 'transform 180ms ease-out',
              }}
            />
          </IconButton>
          <Box
            sx={{
              // 让标题文字可以收缩：不加 minWidth:0 的话，flex 子项的最小尺寸是内容宽度，
              // 省略号永远不会出现，标题会把右边的按钮挤出容器。
              minWidth: 0,
              mb: { xs: 1, sm: 0 },
            }}
          >
            {isMobile ? (
              <>
                <Typography
                  variant='h5'
                  component='h2'
                  color='text.primary'
                  sx={{ display: 'flex', alignItems: 'baseline', minWidth: 0 }}
                >
                  {/* 主名一行，超出省略。省略的是"这些字没显示"，不是"这个组不存在"，
                      所以后面紧跟着的说明和数量必须常显。 */}
                  <Box
                    component='span'
                    sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {groupMainName}
                  </Box>
                  <Box
                    component='span'
                    color='text.secondary'
                    sx={{ ml: 1, flexShrink: 0, fontSize: FONT_SIZE.caption, fontWeight: 400 }}
                  >
                    ({group.sites.length})
                  </Box>
                </Typography>

                {/* 说明降为次级文字：13px + 次级色，最多两行。
                    它回答的是"这个组里有什么"，扫一眼就够，不需要和标题同一个字号。
                    上限给 2 行而不是 1 行：实测 24 个组的说明里只有最长的那一个
                    （29 字）在 390px 下会溢出，放成 2 行它正好排完，其余 23 个仍是一行 ——
                    总高度只多 21px，却做到一个字都不截。 */}
                {groupNote && (
                  <Typography
                    variant='body2'
                    color='text.secondary'
                    title={groupNote}
                    sx={{
                      mt: 0.25,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {groupNote}
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant='h5' component='h2' color='text.primary'>
                {group.name}
                <Typography component='span' variant='body2' color='text.secondary' sx={{ ml: 1 }}>
                  ({group.sites.length})
                </Typography>
              </Typography>
            )}
          </Box>
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'row', sm: 'row' },
            gap: 1,
            width: { xs: '100%', sm: 'auto' },
            flexWrap: 'wrap',
            justifyContent: { xs: 'flex-start', sm: 'flex-end' },
          }}
        >
          {isCurrentEditingGroup ? (
            <Button
              variant='contained'
              color='primary'
              size='small'
              startIcon={<SaveIcon />}
              onClick={handleSaveSiteOrder}
            >
              保存顺序
            </Button>
          ) : (
            sortMode === 'None' &&
            viewMode === 'edit' && ( // 只在编辑模式显示按钮
              <>
                {onAddSite && group.id && (
                  <Button
                    variant='contained'
                    color='primary'
                    size='small'
                    onClick={() => onAddSite(group.id)}
                    startIcon={<AddIcon />}
                  >
                    添加卡片
                  </Button>
                )}
                <Button
                  variant='outlined'
                  color='primary'
                  size='small'
                  startIcon={<SortIcon />}
                  onClick={handleSortClick}
                >
                  排序
                </Button>

                {onUpdateGroup && onDeleteGroup && (
                  <Tooltip title='编辑分组'>
                    <IconButton
                      color='primary'
                      onClick={handleEditClick}
                      size='small'
                      sx={{ alignSelf: 'center' }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </>
            )
          )}
        </Box>
      </Box>

      {/* 使用 Collapse 组件包装站点卡片区域 */}
      <Collapse in={!isCollapsed} timeout='auto'>
        {renderSites()}
      </Collapse>

      {/* 编辑分组弹窗 */}
      {onUpdateGroup && onDeleteGroup && (
        <EditGroupDialog
          open={editDialogOpen}
          group={group}
          onClose={() => setEditDialogOpen(false)}
          onSave={handleUpdateGroup}
          onDelete={handleDeleteGroup}
        />
      )}

      {/* 提示消息 */}
      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity='info' sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default GroupCard;
