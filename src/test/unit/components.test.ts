// @status GREEN
// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { PlanistButton } from '../../preview/ui/components/PlanistButton';
import { PlanistToolbar } from '../../preview/ui/components/PlanistToolbar';
import { PlanistBadge } from '../../preview/ui/components/PlanistBadge';
import { PlanistTooltip } from '../../preview/ui/components/PlanistTooltip';

describe('Planist UI 元件單元測試 (Vitest + JSDOM)', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        // 設定獨立的 JSDOM 容器
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    describe('PlanistButton', () => {
        test('正確根據屬性渲染基本按鈕結構與文字', () => {
            const button = new PlanistButton('testBtn', '確認儲存');
            container.innerHTML = button.render();

            const buttonEl = container.querySelector('#testBtn') as HTMLButtonElement;
            expect(buttonEl).not.toBeNull();
            expect(buttonEl.textContent).toBe('確認儲存');
            expect(buttonEl.className).toBe('btn btn-primary');
            expect(buttonEl.getAttribute('title')).toBeNull();
        });

        test('正確渲染自訂型別與提示文字', () => {
            const button = new PlanistButton('successBtn', '成功', 'success', '滑鼠懸停提示');
            container.innerHTML = button.render();

            const buttonEl = container.querySelector('#successBtn') as HTMLButtonElement;
            expect(buttonEl).not.toBeNull();
            expect(buttonEl.className).toBe('btn btn-success');
            expect(buttonEl.getAttribute('title')).toBe('滑鼠懸停提示');
        });
    });

    describe('PlanistToolbar', () => {
        test('正確渲染工具列容器並將子元件嵌入其中', () => {
            const toolbar = new PlanistToolbar();
            const btn1 = new PlanistButton('btn1', '按鈕 1');
            const btn2 = new PlanistButton('btn2', '按鈕 2');
            
            toolbar.addChild(btn1);
            toolbar.addChild(btn2);

            container.innerHTML = toolbar.render();

            const toolbarEl = container.querySelector('#toolbar');
            expect(toolbarEl).not.toBeNull();
            
            const buttons = toolbarEl?.querySelectorAll('button');
            expect(buttons?.length).toBe(2);
            expect(buttons?.[0].id).toBe('btn1');
            expect(buttons?.[1].id).toBe('btn2');
        });
    });

    describe('PlanistBadge', () => {
        test('正確渲染徽章元件類別與初始內容', () => {
            const badge = new PlanistBadge('statusBadge', 'Active');
            container.innerHTML = badge.render();

            const badgeEl = container.querySelector('#statusBadge');
            expect(badgeEl).not.toBeNull();
            expect(badgeEl?.className).toBe('badge');
            expect(badgeEl?.textContent).toBe('Active');
        });
    });

    describe('PlanistTooltip', () => {
        test('正確渲染 Tooltip 畫布懸停提示容器', () => {
            const tooltip = new PlanistTooltip();
            container.innerHTML = tooltip.render();

            const tooltipEl = container.querySelector('#tooltip');
            expect(tooltipEl).not.toBeNull();
        });
    });
});
