// Card组件主文件
// 现代化的React卡片组件，支持多种变体和结构

import React from 'react';
import type {
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardContentProps,
  CardFooterProps
} from './Card.types';
import { CardBase, CardHeader, CardTitle, CardSubtitle, CardContent, CardFooter, CardActions, CardMedia, CardAvatar, CardText } from './Card.styles';

// 主卡片组件
export const Card: React.FC<CardProps> = ({
  variant = 'default',
  size = 'md',
  fullWidth = false,
  disabled = false,
  children,
  onClick,
  className,
  ...props
}) => {
  return (
    <CardBase
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={className}
      role={onClick ? 'button' : 'region'}
      tabIndex={onClick && !disabled ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && !disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      {...props}
    >
      {children}
    </CardBase>
  );
};

// 卡片头部组件
export const CardHeaderComponent: React.FC<CardHeaderProps> = ({
  children,
  className,
  borderBottom = true,
}) => {
  return (
    <CardHeader className={className} borderBottom={borderBottom}>
      {children}
    </CardHeader>
  );
};

// 卡片标题组件
export const CardTitleComponent: React.FC<CardTitleProps> = ({
  children,
  className,
  as = 'h3',
}) => {
  return (
    <CardTitle className={className} as={as}>
      {children}
    </CardTitle>
  );
};

// 卡片副标题组件
export const CardSubtitleComponent: React.FC<React.PropsWithChildren<{}>> = ({
  children,
  className,
}) => {
  return (
    <CardSubtitle className={className}>
      {children}
    </CardSubtitle>
  );
};

// 卡片内容组件
export const CardContentComponent: React.FC<CardContentProps> = ({
  children,
  className,
  padded = true,
}) => {
  return (
    <CardContent className={className} padded={padded}>
      {children}
    </CardContent>
  );
};

// 卡片页脚组件
export const CardFooterComponent: React.FC<CardFooterProps> = ({
  children,
  className,
  borderTop = true,
}) => {
  return (
    <CardFooter className={className} borderTop={borderTop}>
      {children}
    </CardFooter>
  );
};

// 卡片操作区域组件
export const CardActionsComponent: React.FC<React.PropsWithChildren<{}>> = ({
  children,
  className,
}) => {
  return (
    <CardActions className={className}>
      {children}
    </CardActions>
  );
};

// 卡片媒体组件
export const CardMediaComponent: React.FC<{ aspectRatio?: string; className?: string }> = ({
  children,
  aspectRatio = '16/9',
  className,
}) => {
  return (
    <CardMedia className={className} aspectRatio={aspectRatio}>
      {children}
    </CardMedia>
  );
};

// 卡片头像组件
export const CardAvatarComponent: React.FC<{ src?: string; alt?: string; className?: string }> = ({
  src,
  alt,
  children,
  className,
}) => {
  return (
    <CardAvatar className={className}>
      {src ? (
        <img src={src} alt={alt} />
      ) : (
        children || alt?.charAt(0).toUpperCase()
      )}
    </CardAvatar>
  );
};

// 卡片文本组件
export const CardTextComponent: React.FC<{ variant?: string; className?: string }> = ({
  children,
  variant,
  className,
}) => {
  return (
    <CardText className={`${variant || ''} ${className || ''}`}>
      {children}
    </CardText>
  );
};

// 导出所有组件
export {
  Card,
  CardHeader,
  CardTitle,
  CardSubtitle,
  CardContent,
  CardFooter,
  CardActions,
  CardMedia,
  CardAvatar,
  CardText,
} from './Card.styles';

// 默认导出
export default Card;