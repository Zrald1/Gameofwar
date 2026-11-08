/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createComponent, defineComponents, Types } from '@iwsdk/core';

/** tag: the champion meeple (grabbable -> travel) */
export const Champion = createComponent('Champion', {});

/** tag: the treasure-map scroll (grabbable -> reveals dig sites) */
export const ScrollProp = createComponent('ScrollProp', {});

const CardStates = { IDLE: 'idle', ACTIVE: 'active', DONE: 'done' } as const;

/** pooled quest card: which rail slot + assigned quest */
export const QuestCard = createComponent('QuestCard', {
  slot: { type: Types.Int32, default: 0 },
  questId: { type: Types.Int32, default: -1 },
  cardState: {
    type: Types.Enum,
    default: CardStates.IDLE,
    enum: CardStates,
  },
});

/** tag: the X dig-site marker (press to dig) */
export const DigMarker = createComponent('DigMarker', {
  digId: { type: Types.Int32, default: -1 },
});

/** tag: chest that plays open animation then despawns */
export const ChestProp = createComponent('ChestProp', {
  openT: { type: Types.Float32, default: -1 },
});

/** tag: survey beacon pillar for survey quests */
export const BeaconProp = createComponent('BeaconProp', {
  questId: { type: Types.Int32, default: -1 },
});

/** tag: wish crystal pedestal (press -> boosted quest) */
export const WishTag = createComponent('WishTag', {});

/** tag: haven plot marker (press -> build house) */
export const HavenTag = createComponent('HavenTag', {});

export default defineComponents([
  Champion,
  ScrollProp,
  QuestCard,
  DigMarker,
  ChestProp,
  BeaconProp,
  WishTag,
  HavenTag,
]);
