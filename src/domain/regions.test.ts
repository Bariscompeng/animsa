import {
  MAX_REGIONS,
  ROTATION_ID,
  ROTATION_MAX_RADIUS_M,
  ROTATION_MIN_RADIUS_M,
  buildRotationRegion,
  clampRadius,
  distanceMeters,
  selectRegions,
  type RegionCandidate,
  type SelectionContext,
} from './regions';
import type { PlaceType } from './types';

const HERE = { lat: 41.0, lng: 29.0 };

const place = (over: Partial<RegionCandidate> & { id: string }): RegionCandidate => ({
  name: over.id,
  type: 'market',
  lat: 41.0,
  lng: 29.0,
  radiusM: 150,
  ...over,
});

/** Offsets a coordinate roughly `m` metres north. */
const north = (m: number): number => 41.0 + m / 111_320;

const ctx = (types: PlaceType[] = []): SelectionContext => ({
  activePlaceTypes: new Set(types),
});

describe('distanceMeters', () => {
  it('returns zero for the same point', () => {
    expect(distanceMeters(HERE, HERE)).toBeCloseTo(0, 5);
  });
  it('approximates a 1 km northward offset', () => {
    const d = distanceMeters(HERE, { lat: north(1000), lng: 29.0 });
    expect(d).toBeGreaterThan(950);
    expect(d).toBeLessThan(1050);
  });
});

describe('clampRadius', () => {
  it('raises a too-small radius to the 100 m floor', () => {
    expect(clampRadius(40)).toBe(100);
  });
  it('lowers a too-large radius to the 1000 m ceiling', () => {
    expect(clampRadius(5000)).toBe(1000);
  });
  it('leaves a sane radius alone', () => {
    expect(clampRadius(150)).toBe(150);
  });
});

describe('selectRegions', () => {
  it('always keeps home and work', () => {
    const regions = selectRegions(
      [place({ id: 'home', type: 'home' }), place({ id: 'work', type: 'work' })],
      HERE,
      ctx(),
    );
    const ids = regions.map((r) => r.id);
    expect(ids).toContain('home');
    expect(ids).toContain('work');
  });

  it('monitors no markets when the list is empty', () => {
    const regions = selectRegions([place({ id: 'm1' }), place({ id: 'm2' })], HERE, ctx());
    expect(regions.filter((r) => r.id !== ROTATION_ID)).toHaveLength(0);
  });

  it('monitors markets when the list has matching items', () => {
    const regions = selectRegions([place({ id: 'm1' })], HERE, ctx(['market']));
    expect(regions.map((r) => r.id)).toContain('m1');
  });

  it('monitors a place referenced by a task trigger even with an empty list', () => {
    const regions = selectRegions([place({ id: 'm1', hasTaskTrigger: true })], HERE, ctx());
    expect(regions.map((r) => r.id)).toContain('m1');
  });

  it('prefers task-trigger places over list-matched ones', () => {
    const regions = selectRegions(
      [
        place({ id: 'listed', lat: north(100) }),
        place({ id: 'triggered', lat: north(5000), hasTaskTrigger: true }),
      ],
      HERE,
      ctx(['market']),
    );
    const ids = regions.filter((r) => r.id !== ROTATION_ID).map((r) => r.id);
    expect(ids[0]).toBe('triggered');
  });

  it('prefers home over everything else', () => {
    const regions = selectRegions(
      [
        place({ id: 'triggered', hasTaskTrigger: true, lat: north(50) }),
        place({ id: 'home', type: 'home', lat: north(9000) }),
      ],
      HERE,
      ctx(['market']),
    );
    expect(regions[0]!.id).toBe('home');
  });

  it('orders equal-priority places by distance', () => {
    const regions = selectRegions(
      [
        place({ id: 'far', lat: north(3000) }),
        place({ id: 'near', lat: north(200) }),
        place({ id: 'mid', lat: north(1000) }),
      ],
      HERE,
      ctx(['market']),
    );
    expect(regions.filter((r) => r.id !== ROTATION_ID).map((r) => r.id)).toEqual([
      'near',
      'mid',
      'far',
    ]);
  });

  it('never exceeds the 20-region iOS limit', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      place({ id: `m${i}`, lat: north(100 * (i + 1)) }),
    );
    const regions = selectRegions(many, HERE, ctx(['market']));
    expect(regions).toHaveLength(MAX_REGIONS);
  });

  it('reserves exactly one slot for the rotation region', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      place({ id: `m${i}`, lat: north(100 * (i + 1)) }),
    );
    const regions = selectRegions(many, HERE, ctx(['market']));
    expect(regions.filter((r) => r.id === ROTATION_ID)).toHaveLength(1);
    expect(regions.filter((r) => r.id !== ROTATION_ID)).toHaveLength(MAX_REGIONS - 1);
  });

  it('skips the rotation region when the current position is unknown', () => {
    const regions = selectRegions([place({ id: 'm1' })], null, ctx(['market']));
    expect(regions.map((r) => r.id)).not.toContain(ROTATION_ID);
  });

  it('skips disabled places', () => {
    const regions = selectRegions(
      [place({ id: 'off', enabled: false }), place({ id: 'on' })],
      HERE,
      ctx(['market']),
    );
    expect(regions.map((r) => r.id)).not.toContain('off');
    expect(regions.map((r) => r.id)).toContain('on');
  });

  it('clamps each place radius into the safe range', () => {
    const regions = selectRegions(
      [place({ id: 'tiny', radiusM: 10 }), place({ id: 'huge', radiusM: 9000 })],
      HERE,
      ctx(['market']),
    );
    const tiny = regions.find((r) => r.id === 'tiny');
    const huge = regions.find((r) => r.id === 'huge');
    expect(tiny!.radiusM).toBe(100);
    expect(huge!.radiusM).toBe(1000);
  });

  it('watches both directions at home', () => {
    const regions = selectRegions([place({ id: 'home', type: 'home' })], HERE, ctx());
    const home = regions.find((r) => r.id === 'home');
    expect(home!.notifyOnEnter).toBe(true);
    expect(home!.notifyOnExit).toBe(true);
  });

  it('watches only entry for a plain market', () => {
    const regions = selectRegions([place({ id: 'm1' })], HERE, ctx(['market']));
    const m1 = regions.find((r) => r.id === 'm1');
    expect(m1!.notifyOnEnter).toBe(true);
    expect(m1!.notifyOnExit).toBe(false);
  });

  it('matches pharmacies only when the list needs a pharmacy', () => {
    const candidates = [place({ id: 'ecz', type: 'pharmacy' })];
    expect(selectRegions(candidates, HERE, ctx(['market'])).map((r) => r.id)).not.toContain('ecz');
    expect(selectRegions(candidates, HERE, ctx(['pharmacy'])).map((r) => r.id)).toContain('ecz');
  });
});

describe('buildRotationRegion', () => {
  it('uses half the distance to the furthest place', () => {
    const region = buildRotationRegion(HERE, [1000, 2000]);
    expect(region.radiusM).toBe(1000);
  });

  it('clamps up to the 800 m floor', () => {
    const region = buildRotationRegion(HERE, [200]);
    expect(region.radiusM).toBe(ROTATION_MIN_RADIUS_M);
  });

  it('clamps down to the 3000 m ceiling', () => {
    const region = buildRotationRegion(HERE, [50_000]);
    expect(region.radiusM).toBe(ROTATION_MAX_RADIUS_M);
  });

  it('uses the floor when there are no places at all', () => {
    expect(buildRotationRegion(HERE, []).radiusM).toBe(ROTATION_MIN_RADIUS_M);
  });

  it('fires on exit only', () => {
    const region = buildRotationRegion(HERE, [1000]);
    expect(region.notifyOnExit).toBe(true);
    expect(region.notifyOnEnter).toBe(false);
  });
});
