// src/components/SiteCard.tsx
import { useState, memo } from 'react';
import { Site } from '../API/http';
import SiteSettingsModal from './SiteSettingsModal';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
// 引入Material UI组件
import {
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Skeleton,
  IconButton,
  Box,
  Fade,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { alpha } from '@mui/material/styles';
import { RADIUS, FONT_SIZE } from '../theme';

interface SiteCardProps {
  site: Site;
  onUpdate: (updatedSite: Site) => void;
  onDelete: (siteId: number) => void;
  isEditMode?: boolean;
  viewMode?: 'readonly' | 'edit'; // 访问模式
  index?: number;
  iconApi?: string; // 添加iconApi属性
}

// 使用memo包装组件以减少不必要的重渲染
const SiteCard = memo(function SiteCard({
  site,
  onUpdate,
  onDelete,
  isEditMode = false,
  viewMode = 'edit', // 默认为编辑模式
  index = 0,
  iconApi, // 添加iconApi参数
}: SiteCardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [iconError, setIconError] = useState(!site.icon);
  const [imageLoaded, setImageLoaded] = useState(false);

  // 使用dnd-kit的useSortable hook
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `site-${site.id || index}`,
    disabled: !isEditMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 9999 : 'auto',
    opacity: isDragging ? 0.8 : 1,
    position: 'relative' as const,
    // 这一层是网格里的一格（排序模式下由 dnd-kit 包一层 div）。
    // 给它 height:100% 才能让内部卡片的 height:100% 解析到整行高度，
    // 否则同一行里描述行数不同的卡片会高低不齐。
    height: '100%',
  };

  // 如果没有图标，使用首字母作为图标
  const fallbackIcon = site.name.charAt(0).toUpperCase();

  // 处理设置按钮点击
  const handleSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止卡片点击事件
    e.preventDefault(); // 防止默认行为
    setShowSettings(true);
  };

  // 处理关闭设置
  const handleCloseSettings = () => {
    setShowSettings(false);
  };

  // 处理卡片点击
  const handleCardClick = () => {
    if (!isEditMode && site.url) {
      window.open(site.url, '_blank');
    }
  };

  // 处理图标加载错误
  const handleIconError = () => {
    setIconError(true);
  };

  // 处理图片加载完成
  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  // 卡片内容
  const cardContent = (
    // 去掉 hover 的 translateY(-4px)：卡片是网格里的一格，位置由网格决定。
    // 整格上浮会盖住上一行的描边、并让相邻卡片看起来错行；改由阴影变化表达悬停。
    <Box
      sx={{
        height: '100%',
        position: 'relative',
      }}
    >
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: RADIUS.card,
          transition: 'box-shadow 0.3s ease-in-out',
          border: '1px solid',
          borderColor: 'divider',
          // 1 / 5 / 8 是主题里的三档阴影索引（见 src/theme.ts 的 buildShadows）：
          // 静止 → 悬停 → 拖拽中。不要写具体的 box-shadow 字符串。
          boxShadow: isDragging ? 8 : 1,
          '&:hover': !isEditMode
            ? {
                boxShadow: 5,
              }
            : {},
          overflow: 'hidden',
          // 留一点透明度，让「网站设置」里的背景图能透上来；颜色本身取自主题
          backgroundColor: (theme) => alpha(theme.palette.background.paper, 0.9),
          backdropFilter: 'blur(5px)',
        }}
      >
        {isEditMode ? (
          <Box
            sx={{
              height: '100%',
              p: { xs: 1.5, sm: 2 },
              cursor: 'grab',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box position='absolute' top={8} right={8}>
              <DragIndicatorIcon fontSize='small' color='primary' />
            </Box>
            {/* 图标和名称 */}
            <Box display='flex' alignItems='center' mb={1}>
              {!iconError && site.icon ? (
                <Box position='relative' mr={1.5} width={32} height={32} flexShrink={0}>
                  <Skeleton
                    variant='rounded'
                    width={32}
                    height={32}
                    sx={{
                      display: !imageLoaded ? 'block' : 'none',
                      position: 'absolute',
                    }}
                  />
                  <Fade in={imageLoaded} timeout={500}>
                    <Box
                      component='img'
                      src={site.icon}
                      alt={site.name}
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: RADIUS.control,
                        objectFit: 'cover',
                      }}
                      onError={handleIconError}
                      onLoad={handleImageLoad}
                    />
                  </Fade>
                </Box>
              ) : (
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    mr: 1.5,
                    borderRadius: RADIUS.control,
                    // 深色模式下 primary.light 比 primary.main 更亮，套上「浅底深字」会变成
                    // 浅蓝底 + 浅蓝字，首字母几乎看不见。改成主色的半透明底 + 主色字，两种模式都成立。
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                    color: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid',
                    borderColor: (theme) => alpha(theme.palette.primary.main, 0.22),
                  }}
                >
                  {fallbackIcon}
                </Box>
              )}
              <Typography
                variant='subtitle1'
                noWrap
                sx={{
                  // 主题正文档 15px；窄屏退到 14px，免得长站名挤成两行
                  fontSize: { xs: 14, sm: FONT_SIZE.body },
                }}
              >
                {site.name}
              </Typography>
            </Box>

            {/* 描述 */}
            <Typography
              variant='body2'
              color='text.secondary'
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                flexGrow: 1,
                fontSize: { xs: 12, sm: FONT_SIZE.caption },
              }}
            >
              {site.description || '暂无描述'}
            </Typography>
          </Box>
        ) : (
          <CardActionArea onClick={handleCardClick} sx={{ height: '100%' }}>
            <CardContent
              sx={{
                position: 'relative',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                p: { xs: 1.5, sm: 2 },
                '&:last-child': { pb: { xs: 1.5, sm: 2 } },
              }}
            >
              {/* 图标和名称 */}
              <Box display='flex' alignItems='center' mb={1}>
                {!iconError && site.icon ? (
                  <Box position='relative' mr={1.5} width={32} height={32} flexShrink={0}>
                    <Skeleton
                      variant='rounded'
                      width={32}
                      height={32}
                      sx={{
                        display: !imageLoaded ? 'block' : 'none',
                        position: 'absolute',
                      }}
                    />
                    <Fade in={imageLoaded} timeout={500}>
                      <Box
                        component='img'
                        src={site.icon}
                        alt={site.name}
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: RADIUS.control,
                          objectFit: 'cover',
                        }}
                        onError={handleIconError}
                        onLoad={handleImageLoad}
                      />
                    </Fade>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      mr: 1.5,
                      borderRadius: RADIUS.control,
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                      color: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid',
                      borderColor: (theme) => alpha(theme.palette.primary.main, 0.22),
                    }}
                  >
                    {fallbackIcon}
                  </Box>
                )}
                <Typography
                  variant='subtitle1'
                  noWrap
                  sx={{
                    fontSize: { xs: 14, sm: FONT_SIZE.body },
                  }}
                >
                  {site.name}
                </Typography>
              </Box>

              {/* 描述 */}
              <Typography
                variant='body2'
                color='text.secondary'
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  flexGrow: 1,
                  fontSize: { xs: 12, sm: FONT_SIZE.caption },
                }}
              >
                {site.description || '暂无描述'}
              </Typography>

              {/* 设置按钮 - 只在编辑模式显示 */}
              {viewMode === 'edit' && (
                <IconButton
                  size='small'
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'action.hover',
                    // 按「设备有没有悬停能力」区分，而不是猜屏幕宽度：
                    // 有鼠标的设备保持悬停才显示（免得常驻图标压住标题）；
                    // 手机/平板没有 hover，改为常显，否则这个入口根本点不到。
                    opacity: 0,
                    transition: 'opacity 180ms ease-out',
                    '@media (hover: none)': { opacity: 0.35 },
                    '&:hover': {
                      bgcolor: 'action.selected',
                      opacity: 1,
                    },
                    // 键盘 Tab 到它时同样要看得见，否则键盘用户不知道焦点在哪
                    '&:focus-visible': {
                      opacity: 1,
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: 2,
                    },
                    '.MuiCardActionArea-root:hover &': {
                      opacity: 1,
                    },
                  }}
                  onClick={handleSettingsClick}
                  aria-label='网站设置'
                >
                  <SettingsIcon fontSize='small' />
                </IconButton>
              )}
            </CardContent>
          </CardActionArea>
        )}
      </Card>
    </Box>
  );

  if (isEditMode) {
    return (
      <>
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
          {cardContent}
        </div>

        {showSettings && (
          <SiteSettingsModal
            site={site}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onClose={handleCloseSettings}
            iconApi={iconApi} // 传递iconApi给SiteSettingsModal
          />
        )}
      </>
    );
  }

  return (
    <>
      {cardContent}

      {showSettings && (
        <SiteSettingsModal
          site={site}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={handleCloseSettings}
          iconApi={iconApi} // 传递iconApi给SiteSettingsModal
        />
      )}
    </>
  );
});

export default SiteCard;
