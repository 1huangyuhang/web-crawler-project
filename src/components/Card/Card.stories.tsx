// Card组件Storybook文档

import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardActions, CardAvatar, CardText } from './Card';
import { Button } from '../Button';

const meta = {
  title: 'Components/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '一个现代化的卡片组件，支持多种变体和结构。',
      },
    },
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'elevated', 'outlined'],
      description: '卡片变体',
      defaultValue: 'default',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: '卡片尺寸',
      defaultValue: 'md',
    },
    fullWidth: {
      control: { type: 'boolean' },
      description: '完整宽度',
      defaultValue: false,
    },
    disabled: {
      control: { type: 'boolean' },
      description: '禁用状态',
      defaultValue: false,
    },
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

// 基础卡片
export const Default: Story = {
  args: {
    children: (
      <>
        <CardHeader>
          <CardAvatar>JD</CardAvatar>
          <div>
            <CardTitle>John Doe</CardTitle>
            <CardText muted>Software Engineer</CardText>
          </div>
        </CardHeader>
        <CardContent>
          <CardText>
            This is a basic card component with header, content, and footer sections.
          </CardText>
        </CardContent>
        <CardFooter>
          <CardActions>
            <Button size="sm">Action 1</Button>
            <Button size="sm" variant="secondary">Action 2</Button>
          </CardActions>
        </CardFooter>
      </>
    ),
  },
};

// 不同变体
export const Elevated: Story = {
  args: {
    variant: 'elevated',
    children: (
      <>
        <CardHeader>
          <CardTitle>Elevated Card</CardTitle>
        </CardHeader>
        <CardContent>
          <CardText>
            This card has an elevated shadow effect for more prominence.
          </CardText>
        </CardContent>
      </>
    ),
  },
};

export const Outlined: Story = {
  args: {
    variant: 'outlined',
    children: (
      <>
        <CardHeader>
          <CardTitle>Outlined Card</CardTitle>
        </CardHeader>
        <CardContent>
          <CardText>
            This card has an outlined border without shadow.
          </CardText>
        </CardContent>
      </>
    ),
  },
};

// 不同尺寸
export const Small: Story = {
  args: {
    size: 'sm',
    children: (
      <>
        <CardHeader>
          <CardTitle>Small Card</CardTitle>
        </CardHeader>
        <CardContent>
          <CardText>
            Compact card for limited space.
          </CardText>
        </CardContent>
      </>
    ),
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: (
      <>
        <CardHeader>
          <CardTitle>Large Card</CardTitle>
        </CardHeader>
        <CardContent>
          <CardText>
            Large card with more space for content.
          </CardText>
        </CardContent>
      </>
    ),
  },
};

// 完整宽度
export const FullWidth: Story = {
  args: {
    fullWidth: true,
    children: (
      <>
        <CardHeader>
          <CardTitle>Full Width Card</CardTitle>
        </CardHeader>
        <CardContent>
          <CardText>
            This card spans the full width of its container.
          </CardText>
        </CardContent>
      </>
    ),
  },
  parameters: {
    layout: 'padded',
  },
};

// 禁用状态
export const Disabled: Story = {
  args: {
    disabled: true,
    children: (
      <>
        <CardHeader>
          <CardTitle>Disabled Card</CardTitle>
        </CardHeader>
        <CardContent>
          <CardText>
            This card is disabled and cannot be interacted with.
          </CardText>
        </CardContent>
      </>
    ),
  },
};

// 带媒体内容
export const WithMedia: Story = {
  render: () => (
    <Card style={{ width: '350px' }}>
      <div style={{ padding: '16px' }}>
        <div
          style={{
            backgroundColor: '#e5e7eb',
            height: '200px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
          }}
        >
          Image/Video
        </div>
      </div>
      <CardContent>
        <CardTitle>Card with Media</CardTitle>
        <CardText>
          This card includes a media section for images, videos, or other visual content.
        </CardText>
      </CardContent>
      <CardFooter>
        <CardActions>
          <Button size="sm">Learn More</Button>
        </CardActions>
      </CardFooter>
    </Card>
  ),
};

// 交互式卡片
export const Interactive: Story = {
  args: {
    onClick: () => alert('Card clicked!'),
    children: (
      <>
        <CardHeader>
          <CardTitle>Interactive Card</CardTitle>
        </CardHeader>
        <CardContent>
          <CardText>
            Click this card to trigger an action.
          </CardText>
        </CardContent>
      </>
    ),
  },
};