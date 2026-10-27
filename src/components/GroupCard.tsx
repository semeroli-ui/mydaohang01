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
  horizontalListSortingStrategy,
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
} from '@mui/material';
import SortIcon from '@mui/icons-material/Sort';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { alpha } from '@mui/material/styles';
import { RADIUS } from '../theme';

// 卡片列宽：编辑态与只读态共用同一套。此前两处分别写死（md 一个 25%、一个 33.33%），
// 导致点一下「编辑」整页重排、用户正在看的卡片会跳位。
const CARD_WIDTH = { xs: '100%', sm: '50%', md: '33.33%', lg: '25%', xl: '20%' } as const;

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

    // 如果是编辑模式，使用DndContext包装
    if (isCurrentEditingGroup) {
      return (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleSiteDragEnd}
        >
          <SortableContext
            items={sitesToRender.map((site) => `site-${site.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            <Box sx={{ width: '100%' }}>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  margin: -1, // 抵消内部padding，确保边缘对齐
                }}
              >
                {sitesToRender.map((site, idx) => (
                  <Box
                    key={site.id || idx}
                    sx={{
                      width: CARD_WIDTH,
                      padding: 1, // 内部间距，更均匀的分布
                      boxSizing: 'border-box', // 确保padding不影响宽度计算
                    }}
                  >
                    <SiteCard
                      site={site}
                      onUpdate={onUpdate}
                      onDelete={onDelete}
                      isEditMode={true}
                      viewMode={viewMode}
                      index={idx}
                      iconApi={configs?.['site.iconApi']} // 传入iconApi配置
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          </SortableContext>
        </DndContext>
      );
    }

    // 普通模式下的渲染
    return (
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          margin: -1, // 抵消内部padding，确保边缘对齐
        }}
      >
        {sitesToRender.map((site) => (
          <Box
            key={site.id}
            sx={{
              width: CARD_WIDTH,
              padding: 1, // 内部间距，更均匀的分布
              boxSizing: 'border-box', // 确保padding不影响宽度计算
            }}
          >
            <SiteCard
              site={site}
              onUpdate={onUpdate}
              onDelete={onDelete}
              isEditMode={false}
              viewMode={viewMode}
              iconApi={configs?.['site.iconApi']} // 传入iconApi配置
            />
          </Box>
        ))}
      </Box>
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
        transition: 'all 0.3s ease-in-out',
        border: '1px solid transparent',
        // 1 / 5 是主题的三档阴影索引：静止 / 抬一级（见 src/theme.ts）
        boxShadow: sortMode === 'None' ? 1 : 5,
        // 排序时的非当前分组：淡出 + 禁止交互，但内容保留，避免用户误以为数据丢失
        opacity: isDimmed ? 0.4 : 1,
        pointerEvents: isDimmed ? 'none' : 'auto',
        '&:hover': {
          boxShadow: 5,
          borderColor: 'divider',
          transform: sortMode === 'None' ? 'scale(1.01)' : 'none',
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
            alignItems: 'center',
            // 24px 图标按钮 + 4px 间距 = 28px，左移等量让标题文字与下方卡片左边缘落在同一条竖线上
            ml: '-28px',
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
            sx={{ width: 24, height: 24, p: 0 }}
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
          <Typography
            variant='h5'
            component='h2'
            color='text.primary'
            sx={{ mb: { xs: 1, sm: 0 } }}
          >
            {group.name}
            <Typography component='span' variant='body2' color='text.secondary' sx={{ ml: 1 }}>
              ({group.sites.length})
            </Typography>
          </Typography>
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
