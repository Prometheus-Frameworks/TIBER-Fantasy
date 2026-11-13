/**
 * @jest-environment jsdom
 *
 * Mounted-component regressions for the Architecture Lab (TIBER-Fantasy #434),
 * covering the two interaction defects found in review of c8ae2fb:
 *   1. a slow drag (many sub-threshold pointer moves) never became a drag;
 *   2. the inspector's return control did nothing while the Schedule was shown.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

jest.mock('../architectureLab.css', () => ({}), { virtual: true });

// eslint-disable-next-line import/first
import ArchitectureLab from '../ArchitectureLab';

const narrow = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  });
};

const mount = () => {
  const view = render(React.createElement(ArchitectureLab));
  const svg = view.container.querySelector('svg.alab-canvas') as SVGSVGElement;
  const world = () => (view.container.querySelector('svg.alab-canvas > g') as SVGGElement).getAttribute('transform');
  return { ...view, svg, world };
};

// jsdom may not carry pointer coordinates on synthetic PointerEvents; build MouseEvents under pointer names.
const pointer = (target: Element, type: string, x: number, y: number, pointerId = 1) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  act(() => {
    target.dispatchEvent(event);
  });
};

const heading = () => within(screen.getByLabelText('Inspector')).getByRole('heading', { level: 2 }).textContent;
const HOME = 'translate(0 0) scale(1)';

beforeEach(() => {
  narrow(false);
  Element.prototype.scrollIntoView = jest.fn();
});
afterEach(cleanup);

describe('drag detection', () => {
  test('a slow drag of many 1px moves pans by the total travel and suppresses the click', () => {
    const { svg, world, container } = mount();
    const node = container.querySelector('g.alab-node[aria-label^="TIBER-Data"]') as SVGGElement;
    expect(world()).toBe(HOME);

    pointer(node, 'pointerdown', 100, 100);
    for (let i = 1; i <= 100; i += 1) pointer(node, 'pointermove', 100 + i, 100);
    pointer(node, 'pointerup', 200, 100);
    fireEvent.click(node);

    // jsdom reports a zero-size SVG, so one screen pixel maps to one sheet unit.
    expect(world()).toBe('translate(100 0) scale(1)');
    expect(heading()).toBe('What this model can and cannot tell you');
    expect(svg).toBeTruthy();
  });

  test('the same travel in large steps pans identically', () => {
    const { svg, world } = mount();
    pointer(svg, 'pointerdown', 100, 100);
    for (let i = 1; i <= 20; i += 1) pointer(svg, 'pointermove', 100 + i * 5, 100);
    pointer(svg, 'pointerup', 200, 100);
    expect(world()).toBe('translate(100 0) scale(1)');
  });

  test('a stationary press is a click: it selects and does not pan', () => {
    const { world, container } = mount();
    const node = container.querySelector('g.alab-node[aria-label^="TIBER-Data"]') as SVGGElement;
    pointer(node, 'pointerdown', 100, 100);
    pointer(node, 'pointerup', 100, 100);
    fireEvent.click(node);
    expect(world()).toBe(HOME);
    expect(heading()).toBe('TIBER-Data');
  });

  test('jitter inside the threshold is still a click', () => {
    const { world, container } = mount();
    const node = container.querySelector('g.alab-node[aria-label^="TIBER-Forecast"]') as SVGGElement;
    pointer(node, 'pointerdown', 100, 100);
    pointer(node, 'pointermove', 102, 101);
    pointer(node, 'pointermove', 101, 102);
    pointer(node, 'pointerup', 101, 102);
    fireEvent.click(node);
    expect(world()).toBe(HOME);
    expect(heading()).toBe('TIBER-Forecast');
  });

  test('a drag that returns near its origin stays a drag and does not select', () => {
    const { container } = mount();
    const node = container.querySelector('g.alab-node[aria-label^="TIBER-Data"]') as SVGGElement;
    pointer(node, 'pointerdown', 100, 100);
    pointer(node, 'pointermove', 130, 100);
    pointer(node, 'pointermove', 101, 100);
    pointer(node, 'pointerup', 101, 100);
    fireEvent.click(node);
    expect(heading()).toBe('What this model can and cannot tell you');
  });
});

describe('inspector return control', () => {
  const stage = (container: HTMLElement) => container.querySelector('section.alab-stage') as HTMLElement;

  test('from the Schedule: selecting a row scrolls to the inspector, and the control scrolls back to the stage', () => {
    narrow(true);
    jest.useFakeTimers();
    const { container } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    expect(container.querySelector('svg.alab-canvas')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /TIBER-Data → TIBER-Rookies/ }));
    act(() => {
      jest.runAllTimers();
    });
    jest.useRealTimers();
    const scroll = Element.prototype.scrollIntoView as jest.Mock;
    expect(scroll.mock.instances[0]).toBe(screen.getByLabelText('Inspector'));
    expect(heading()).toContain('TIBER-Data');

    scroll.mockClear();
    const back = screen.getByRole('button', { name: '↑ Schedule' });
    fireEvent.click(back);
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.instances[0]).toBe(stage(container));
    // It returns to the view the reader came from; it does not silently switch panes.
    expect(container.querySelector('table.alab-schedule')).not.toBeNull();
  });

  test('from the Model: the control is labelled for the model and scrolls to the stage', () => {
    narrow(true);
    const { container } = mount();
    const scroll = Element.prototype.scrollIntoView as jest.Mock;
    fireEvent.click(screen.getByRole('button', { name: '↑ Model' }));
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll.mock.instances[0]).toBe(stage(container));
    expect(container.querySelector('svg.alab-canvas')).not.toBeNull();
  });
});

describe('evidence floor wording', () => {
  test('the Replayed floor says its checks are not integration runs', () => {
    mount();
    fireEvent.click(screen.getByRole('radio', { name: /Replayed/ }));
    expect(screen.getByText(/artifact and contract byte checks; no integration was executed/)).toBeTruthy();
  });

  test('the Runtime floor says nothing was observed running', () => {
    mount();
    fireEvent.click(screen.getByRole('radio', { name: /Runtime observed/ }));
    expect(screen.getByText(/0 of 21/)).toBeTruthy();
    expect(screen.getByText(/Nothing on this sheet has been observed running/)).toBeTruthy();
  });
});
