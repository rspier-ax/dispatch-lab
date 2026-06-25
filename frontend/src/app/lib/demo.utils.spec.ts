import { demoNextScriptLabel, demoProgressPercent, demoScenarios, demoSimulationTimeLabel } from './demo.utils';
import { FALLBACK_DEMO_INFO } from './demo.constants';

describe('demo.utils', () => {
  it('falls back to guided scenarios when demo info is null', () => {
    expect(demoScenarios(null).length).toBe(3);
  });

  it('describes next scheduled script', () => {
    const label = demoNextScriptLabel(FALLBACK_DEMO_INFO, 10);
    expect(label).toContain('POA-07');
    expect(label).toContain('tick 45');
  });

  it('reports completed scripts after tick 90', () => {
    expect(demoNextScriptLabel(FALLBACK_DEMO_INFO, 95)).toBe('Todos os scripts executados');
  });

  it('computes progress toward tick 90', () => {
    expect(demoProgressPercent(45)).toBe(50);
    expect(demoProgressPercent(100)).toBe(100);
  });

  it('formats simulation clock from tick', () => {
    expect(demoSimulationTimeLabel(0)).toBe('14:30:00 · Ao vivo');
    expect(demoSimulationTimeLabel(60)).toBe('14:31:00 · Ao vivo');
  });
});
