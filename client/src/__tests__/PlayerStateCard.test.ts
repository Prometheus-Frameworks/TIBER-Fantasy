/** @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PlayerStateCard } from '../components/draftReview/PlayerStateCard';
import { displayCount, displayDelta, displayPercent, displayPoints } from '../components/draftReview/playerStateCardViewModel';
import type { CardModel } from '../components/draftReview/playerStateCardViewModel';

jest.mock('../components/draftReview/PlayerStateCard.css', () => ({}));

const model = JSON.parse(readFileSync(resolve(process.cwd(), 'server/modules/draftReview/artifacts/watsonGbCase01ReadModel.json'), 'utf8')) as CardModel;
afterEach(cleanup);

test('accessible 390px presentation preserves exact observed counts, denominators and unavailable distinction', () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
  render(React.createElement(PlayerStateCard, { model }));
  expect(screen.getByRole('heading', { name: 'Christian Watson' })).toBeTruthy();
  expect(screen.getByText(/Sleeper roster identity unresolved/)).toBeTruthy();
  expect(screen.getByText(/Provisional · finality unknown · corrections open/)).toBeTruthy();
  expect(screen.getByText(/8\/40 \(20\.0%\) → 11\/29 \(37\.9%\) · \+17\.9 pp/)).toBeTruthy();
  expect(screen.getByText(/The denominator is credited team targets, distinct from team pass attempts/)).toBeTruthy();
  expect(screen.getByText(/routes, snaps, alignment, first reads/)).toBeTruthy();
  expect(displayCount(0)).toBe('0');
  expect(displayCount(null)).toBe('Unavailable');
  expect(displayDelta(null)).toBe('Unavailable');
  expect(displayPercent(model.roleOpportunity.targetShareCreditedTeamTargets.week2.value)).toBe('37.9%');
  expect(displayPoints(model.roleOpportunity.targetShareCreditedTeamTargets.percentagePointDelta)).toBe('+17.9 pp');
  fireEvent.click(screen.getByText('All ten reviewed team fields'));
  const table = screen.getByRole('table', { name: /GB activity/ });
  expect(table.querySelectorAll('tbody tr')).toHaveLength(10);
  expect(screen.getByRole('region', { name: 'Green Bay weekly team activity' })).toHaveProperty('tabIndex', 0);
  fireEvent.click(screen.getByText('Evidence health, claim states & provenance'));
  expect(screen.getByText(/Same-source reconciliation is internal consistency/)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'nflverse contributors' }).getAttribute('href')).toBe('https://github.com/nflverse/nflverse-data');
  expect(screen.getByRole('link', { name: 'CC BY 4.0' }).getAttribute('href')).toBe('https://creativecommons.org/licenses/by/4.0/');
  expect(screen.getByText(/Source licensing does not grant TIBER consumer admission/)).toBeTruthy();
});

test('UI carries only two producer joint sentences and never a hypothesis or roster claim', () => {
  const { container } = render(React.createElement(PlayerStateCard, { model }));
  const output = container.textContent || '';
  for (const x of model.jointObservations) expect(output).toContain(x.text);
  expect(output).not.toMatch(/Jayden Reed|H1|H2|H3|Week 3|buy|sell|start\/sit|fantasy points|predicted/);
  expect(output).not.toContain('owned by');
  expect(screen.getByRole('heading', { name: 'Missing evidence' })).toBeTruthy();
});
