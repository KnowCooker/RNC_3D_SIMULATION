/** Joint filtered-reference energy normalization, shared by batch and streaming.
 * W_jk <- W_jk - mu/(epsilon + sum_mjk ||S_mj*x_k||²) * sum_m e_m (S_mj*x_k).
 * A/Z display weighting never enters this controller update.
 */
export function nfxlmsGain(stepSize: number, filteredEnergies: Float64Array): number {
  return stepSize / (1e-6 + filteredEnergies.reduce((sum, power) => sum + power, 0));
}
