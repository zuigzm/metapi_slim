import { afterEach, beforeEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../components/Toast.js';
import TokenRoutes from './TokenRoutes.js';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);

// Polyfill IntersectionObserver for jsdom
beforeAll(() => {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
    takeRecords() { return []; }
  } as unknown as typeof IntersectionObserver;
});

// Mock routes that will match gpt-4* pattern
const mockRoutes = [
  { id: 1, modelPattern: 'gpt-4o', displayName: 'GPT-4O', channelCount: 2, decisionSnapshot: null, decisionRefreshedAt: null, enabled: true, enabledChannelCount: 2, siteNames: ['site-a'] },
  { id: 2, modelPattern: 'gpt-4o-mini', displayName: 'GPT-4O-Mini', channelCount: 1, decisionSnapshot: null, decisionRefreshedAt: null, enabled: true, enabledChannelCount: 1, siteNames: ['site-a'] },
  { id: 3, modelPattern: 'gpt-4-turbo', displayName: 'GPT-4-Turbo', channelCount: 3, decisionSnapshot: null, decisionRefreshedAt: null, enabled: true, enabledChannelCount: 3, siteNames: ['site-b'] },
];

const { apiMock, getBrandMock } = vi.hoisted(() => ({
  apiMock: {
    getRoutesSummary: vi.fn(),
    getRouteChannels: vi.fn(),
    getModelTokenCandidates: vi.fn(),
    getRouteDecisionsBatch: vi.fn(),
    getRouteWideDecisionsBatch: vi.fn(),
    updateRoute: vi.fn(),
    addRoute: vi.fn(),
    batchUpdateChannels: vi.fn(),
    getAutoAggRules: vi.fn(),
    saveAutoAggRules: vi.fn(),
    rebuildRoutes: vi.fn(),
    getTask: vi.fn(),
    refreshRouteDecision: vi.fn(),
  },
  getBrandMock: vi.fn(),
}));

vi.mock('../api.js', () => ({
  api: apiMock,
}));

vi.mock('../components/BrandIcon.js', () => ({
  BrandGlyph: ({ brand, icon, model }: { brand?: { name?: string } | null; icon?: string | null; model?: string | null }) => (
    <span data-testid="brand-glyph">{brand?.name || icon || model || ''}</span>
  ),
  InlineBrandIcon: ({ model }: { model: string }) => model ? <span data-testid="inline-brand-icon">{model}</span> : null,
  getBrand: (...args: unknown[]) => getBrandMock(...args),
  hashColor: () => 'linear-gradient(135deg,#4f46e5,#818cf8)',
  normalizeBrandIconKey: (icon: string) => icon,
}));

describe('TokenRoutes 自动聚合功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBrandMock.mockReturnValue(null);
    apiMock.getRoutesSummary.mockResolvedValue(mockRoutes);
    apiMock.getAutoAggRules.mockResolvedValue([]);
    apiMock.saveAutoAggRules.mockResolvedValue({ success: true });
    apiMock.rebuildRoutes.mockResolvedValue({ queued: false, rebuild: { createdRoutes: 0, createdChannels: 0 } });
    apiMock.getRouteDecisionsBatch.mockResolvedValue({ decisions: {} });
    apiMock.getRouteWideDecisionsBatch.mockResolvedValue({ decisions: {} });
    apiMock.getModelTokenCandidates.mockResolvedValue({ models: {} });
    apiMock.getRouteChannels.mockResolvedValue([]);
    apiMock.getTask.mockResolvedValue(null);
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('能够打开自动聚合弹窗', async () => {
    render(
      <MemoryRouter initialEntries={['/routes']}>
        <ToastProvider>
          <TokenRoutes />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '自动聚合' })[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: '自动聚合' })[0]);

    await waitFor(() => {
      expect(screen.getByText('添加多条聚合规则，一次性创建或更新所有对应群组。')).toBeInTheDocument();
    });
  });

  it('能够添加聚合规则 gpt-4* 并显示匹配到3个路由', async () => {
    render(
      <MemoryRouter initialEntries={['/routes']}>
        <ToastProvider>
          <TokenRoutes />
        </ToastProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '自动聚合' })[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: '自动聚合' })[0]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('模型通配符（如 claude-*）')).toBeInTheDocument();
    });

    const patternInput = screen.getByPlaceholderText('模型通配符（如 claude-*）');
    const displayNameInput = screen.getByPlaceholderText('对外模型名');

    fireEvent.change(patternInput, { target: { value: 'gpt-4*' } });
    fireEvent.change(displayNameInput, { target: { value: 'GPT-4-Group' } });

    await waitFor(() => {
      // 预览匹配数量应该显示
      const previewText = screen.queryByText(/预览.*：.*3.*个精确模型路由/);
      if (previewText) {
        expect(previewText).toBeInTheDocument();
      }
    });

    fireEvent.click(screen.getByRole('button', { name: '添加规则' }));

    await waitFor(() => {
      // 应该显示待处理规则
      expect(screen.getByText(/待处理规则 \(1\)/)).toBeInTheDocument();
      expect(screen.getByText('gpt-4*')).toBeInTheDocument();
      expect(screen.getByText('GPT-4-Group')).toBeInTheDocument();
    });
  });

  it('能够移除已添加的规则', async () => {
    render(
      <MemoryRouter initialEntries={['/routes']}>
        <ToastProvider>
          <TokenRoutes />
        </ToastProvider>
      </MemoryRouter>
    );

    // 打开弹窗
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '自动聚合' })[0]).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole('button', { name: '自动聚合' })[0]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('模型通配符（如 claude-*）')).toBeInTheDocument();
    });

    // 输入并添加规则 - 使用 gpt-4* 来匹配 mockRoutes 中的路由
    fireEvent.change(screen.getByPlaceholderText('模型通配符（如 claude-*）'), { target: { value: 'gpt-4*' } });
    fireEvent.change(screen.getByPlaceholderText('对外模型名'), { target: { value: 'GPT-4-Group' } });

    // 等待预览更新（debounce 延迟）
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    // 点击添加规则
    fireEvent.click(screen.getByRole('button', { name: '添加规则' }));

    // 等待规则列表出现 - 使用条件检查
    await waitFor(() => {
      const ruleText = screen.queryByText(/待处理规则 \(1\)/);
      if (!ruleText) throw new Error('待处理规则未出现');
      expect(ruleText).toBeInTheDocument();
    }, { timeout: 5000 });

    // 点击移除（使用 [0] 获取第一个）
    const removeButtons = screen.queryAllByRole('button', { name: '移除' });
    expect(removeButtons.length).toBeGreaterThan(0);
    fireEvent.click(removeButtons[0]);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '移除' })).not.toBeInTheDocument();
    });
  });

  it('能够确认聚合并保存规则', async () => {
    render(
      <MemoryRouter initialEntries={['/routes']}>
        <ToastProvider>
          <TokenRoutes />
        </ToastProvider>
      </MemoryRouter>
    );

    // 打开弹窗
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '自动聚合' })[0]).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole('button', { name: '自动聚合' })[0]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('模型通配符（如 claude-*）')).toBeInTheDocument();
    });

    // 输入并添加规则 - 使用 gpt-4* 来匹配 mockRoutes 中的路由
    fireEvent.change(screen.getByPlaceholderText('模型通配符（如 claude-*）'), { target: { value: 'gpt-4*' } });
    fireEvent.change(screen.getByPlaceholderText('对外模型名'), { target: { value: 'GPT-4-Group' } });
    fireEvent.click(screen.getByRole('button', { name: '添加规则' }));

    // 等待规则添加
    await waitFor(() => {
      const addBtn = screen.queryByRole('button', { name: '确认聚合' });
      expect(addBtn).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '确认聚合' }));

    await waitFor(() => {
      expect(apiMock.saveAutoAggRules).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('能够编辑已添加的规则', async () => {
    render(
      <MemoryRouter initialEntries={['/routes']}>
        <ToastProvider>
          <TokenRoutes />
        </ToastProvider>
      </MemoryRouter>
    );

    // 打开弹窗
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: '自动聚合' })[0]).toBeInTheDocument();
    });
    fireEvent.click(screen.getAllByRole('button', { name: '自动聚合' })[0]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('模型通配符（如 claude-*）')).toBeInTheDocument();
    });

    // 输入并添加规则 - 使用 gpt-4* 来匹配 mockRoutes 中的路由
    fireEvent.change(screen.getByPlaceholderText('模型通配符（如 claude-*）'), { target: { value: 'gpt-4*' } });
    fireEvent.change(screen.getByPlaceholderText('对外模型名'), { target: { value: 'GPT-4-Group' } });
    fireEvent.click(screen.getByRole('button', { name: '添加规则' }));

    // 等待规则添加
    await waitFor(() => {
      const editBtn = screen.queryAllByRole('button', { name: '编辑' });
      expect(editBtn.length).toBeGreaterThan(0);
    });

    // 点击编辑（使用 [0] 获取第一个）
    const editButtons = screen.getAllByRole('button', { name: '编辑' });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect((screen.getByPlaceholderText('对外模型名') as HTMLInputElement).value).toBe('GPT-4-Group');
    });

    // 修改
    fireEvent.change(screen.getByPlaceholderText('对外模型名'), { target: { value: 'GPT-4-Updated' } });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(apiMock.saveAutoAggRules).toHaveBeenCalled();
    }, { timeout: 5000 });
  });
});