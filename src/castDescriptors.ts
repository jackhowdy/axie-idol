/**
 * Descriptors for the three custom cast faces that have no genes:
 *  - olek: a creator-built stand-in (no official 3D Olek exists)
 *  - agonia-echo: the villain, built from the official Nightmare showcase set
 *  - golden: the villain again, rendered with a gold material (see axie3d gold flag)
 */
import type { AxieDescriptor, ThreeAxieMixer3D } from '@jaatster/threejs-axie-mixer3d-public'
import {
  createAxieCreatorCatalog,
  createDefaultAxieCreatorState,
  createAxieSpecialShowcaseState,
  manualizeAxieCreatorState,
} from '@jaatster/threejs-axie-mixer3d-public/creator'

export type CustomFaceId = 'olek' | 'agonia-echo' | 'golden'

export function isCustomFace(id: string): id is CustomFaceId {
  return id === 'olek' || id === 'agonia-echo' || id === 'golden'
}

/** Olek stand-in: fuzzy orange Beast with an all-Beast part set. */
const OLEK: AxieDescriptor = {
  colorVariant: 4, // beast-04 (orange / cream)
  body: 'fuzzy',
  parts: [
    { type: 'eye', skin: 0, class: 'Beast', variant: 2, level: 1 },
    { type: 'ear', skin: 0, class: 'Beast', variant: 4, level: 1 },
    { type: 'mouth', skin: 0, class: 'Beast', variant: 8, level: 1 },
    { type: 'horn', skin: 0, class: 'Beast', variant: 2, level: 1 },
    { type: 'back', skin: 0, class: 'Beast', variant: 4, level: 1 },
    { type: 'tail', skin: 0, class: 'Beast', variant: 10, level: 1 },
  ],
}

let villainCache: AxieDescriptor | null = null

function villainDescriptor(mixer: ThreeAxieMixer3D): AxieDescriptor {
  if (villainCache) return villainCache
  const catalog = createAxieCreatorCatalog(mixer.manifest)
  const base = createDefaultAxieCreatorState(catalog)
  const showcase = createAxieSpecialShowcaseState(catalog, base, 'nightmare-parts')
  const manual = manualizeAxieCreatorState(showcase, catalog)
  // Nightmare parts on a dark purple body (reptile-01) so the villain reads as a villain
  villainCache = { ...manual.descriptor, colorVariant: 28, body: 'spiky' }
  return villainCache
}

export function descriptorFor(id: CustomFaceId, mixer: ThreeAxieMixer3D): { descriptor: AxieDescriptor; gold: boolean } {
  if (id === 'olek') return { descriptor: OLEK, gold: false }
  const descriptor = villainDescriptor(mixer)
  return { descriptor, gold: id === 'golden' }
}
