import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { EXAMPLES } from './data/examples';
import { promptTool, receiptClaims } from '@vandelay/agent';
import { approvalLink } from './approve/verify';

afterEach(cleanup);

describe('front door', () => {
  it('asks the one question and offers four categories', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'What would you like to build?' })).toBeTruthy();
    for (const name of ['Home', 'Business', 'Mixed-use', 'Venue']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });

  it('routes a typed brief to the matching category on one screen', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Describe what you want to build'), { target: { value: 'a stadium for soccer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByRole('radio', { name: 'Venue' }).getAttribute('aria-checked')).toBe('true');
    // Site, brief and options are all on the same screen.
    expect(screen.getByRole('button', { name: /Site/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Your brief/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Three ways to build it/ })).toBeTruthy();
  });
});

describe('workspace', () => {
  it('labels every figure as an example', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getAllByText(/^Example/).length).toBeGreaterThanOrEqual(2);
    const options = screen.getByRole('radiogroup', { name: 'Options' });
    const cards = within(options).getAllByRole('radio');
    expect(cards).toHaveLength(3);
    for (const card of cards) expect(within(card).getByText(/example/)).toBeTruthy();
    expect(screen.getByText(/every figure shown is an example/)).toBeTruthy();
  });

  it('collapses and expands a widget', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Business' }));
    const toggle = screen.getByRole('button', { name: /Your brief/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('selects an option and switches category in place', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Business' }));
    const opt = screen.getByRole('radio', { name: new RegExp(EXAMPLES.business.options[2].name) });
    fireEvent.click(opt);
    expect(opt.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'Mixed-use' }));
    expect(screen.getByRole('radio', { name: /6 floors over shops/ })).toBeTruthy();
  });
});

describe('home engine', () => {
  it('shows three engine options on an example site, labelled as examples', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    const cards = within(screen.getByRole('radiogroup', { name: 'Options' })).getAllByRole('radio');
    expect(cards).toHaveLength(3);
    // Engine options carry engine labels, not the static example names.
    for (const o of EXAMPLES.home.options) expect(screen.queryByRole('radio', { name: new RegExp(o.name) })).toBeNull();
    expect(screen.getAllByText(/Best fit/).length).toBeGreaterThan(0);
    expect(screen.getByText('Setbacks')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Site.*Example site/ })).toBeTruthy();
  });

  it('explains the checks for the chosen option', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    const chip = screen.getByRole('button', { name: /Why\?/ });
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(chip);
    const panel = screen.getByRole('dialog', { name: 'Checks for this option' });
    expect(within(panel).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(within(panel).getAllByText(/Source:/).length).toBeGreaterThan(0);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Checks for this option' })).toBeNull();
  });
});


describe('approval viewer', () => {
  afterEach(() => {
    window.location.hash = '';
  });

  it('opens from the header and explains bad input', async () => {
    render(<App />);
    expect(screen.getByRole('link', { name: 'Review a design' }).getAttribute('href')).toBe('#/approve');
    window.location.hash = '#/approve';
    fireEvent(window, new HashChangeEvent('hashchange'));
    expect(await screen.findByRole('heading', { name: 'Review a design' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Or paste it'), { target: { value: '{"hello":1}' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByRole('alert').textContent).toMatch(/receipt/);
  });

  it('rebuilds a design from a share link and lets the person approve it', { timeout: 20000 }, async () => {
    const input = { prompt: 'a one-bedroom backyard cottage' };
    const result = JSON.parse(JSON.stringify(promptTool.run(input))) as Record<string, unknown>;
    const claims = receiptClaims({ tool: promptTool.name, input, result, issuedAt: '2026-11-01T12:00:00.000Z', keyId: 'vandelay:0123456789abcdef' });
    window.location.hash = approvalLink('', { ...claims, alg: 'Ed25519', sig: 'AA' }, input);
    render(<App />);
    const status = await screen.findByRole('status', {}, { timeout: 8000 });
    await waitFor(() => expect(status.textContent).toMatch(/Rebuilt and matches/), { timeout: 8000 });
    expect(screen.getAllByRole('radio').length).toBeGreaterThanOrEqual(3);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByText(/^Approved: /)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download record' })).toBeTruthy();
  });
});
