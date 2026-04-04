// Button组件Storybook文档

import type { Meta, StoryObj } from '@storybook/react';
import { Button, PrimaryButton, SecondaryButton, OutlineButton, GhostButton } from './Button';
import { Loader2, Plus, X } from 'lucide-react';

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: '一个现代化的按钮组件，支持多种变体、尺寸和状态。',
      },
    },
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'outline', 'ghost'],
      description: '按钮变体',
      defaultValue: 'primary',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: '按钮尺寸',
      defaultValue: 'md',
    },
    disabled: {
      control: { type: 'boolean' },
      description: '禁用状态',
      defaultValue: false,
    },
    loading: {
      control: { type: 'boolean' },
      description: '加载状态',
      defaultValue: false,
    },
    fullWidth: {
      control: { type: 'boolean' },
      description: '完整宽度',
      defaultValue: false,
    },
    children: {
      control: { type: 'text' },
      description: '按钮内容',
      defaultValue: 'Click me',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// 基础按钮
export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Primary Button',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Button',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline Button',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost Button',
  },
};

// 不同尺寸
export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small Button',
  },
};

export const Medium: Story = {
  args: {
    size: 'md',
    children: 'Medium Button',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large Button',
  },
};

// 状态
export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled Button',
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    children: 'Loading Button',
  },
};

// 带图标
export const WithLeftIcon: Story = {
  args: {
    children: (
      <>
        <Plus size={16} />
        <span>Add Item</span>
      </>
    ),
  },
};

export const WithRightIcon: Story = {
  args: {
    iconPosition: 'right',
    children: (
      <>
        <span>Close</span>
        <X size={16} />
      </>
    ),
  },
};

export const FullWidth: Story = {
  args: {
    fullWidth: true,
    children: 'Full Width Button',
  },
  parameters: {
    layout: 'padded',
  },
};

// 交互演示
export const Interactive: Story = {
  args: {
    children: 'Interactive Button',
  },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector('button');
    if (button) {
      button.addEventListener('click', () => {
        console.log('Button clicked!');
      });
    }
  },
};

// 所有变体组合
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <PrimaryButton>Primary</PrimaryButton>
      <SecondaryButton>Secondary</SecondaryButton>
      <OutlineButton>Outline</OutlineButton>
      <GhostButton>Ghost</GhostButton>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: '展示所有按钮变体的组合效果。',
      },
    },
  },
};