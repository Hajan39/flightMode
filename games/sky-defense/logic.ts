/** The slice of an enemy a bullet hit needs. */
export interface Damageable {
  hp: number;
  reward: number;
}

/**
 * Apply one bullet hit to `enemy` (mutates `hp`) and return the reward it
 * grants. Only the alive → dead transition pays out: several bullets can land
 * on the same enemy in one tick, and hits on an already-dead enemy are ignored
 * so the kill reward is never granted twice.
 */
export function applyBulletHit(enemy: Damageable, damage: number): number {
  if (enemy.hp <= 0) {
    return 0;
  }
  enemy.hp -= damage;
  return enemy.hp <= 0 ? enemy.reward : 0;
}
