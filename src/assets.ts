/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { AssetType, defineAssets } from '@iwsdk/core';
import {
  createBackdrop,
  createBeacon,
  createCard,
  createChest,
  createDigX,
  createGroundFloor,
  createHaven,
  createHouse,
  createMapTable,
  createMeeple,
  createPatron,
  createPropMesh,
  createRelic,
  createScroll,
  createTerrainMesh,
  createWishPedestal,
  createWizard,
} from './scene-assets/game.scene-asset.js';

const publicAssetUrl = (filePath: string): string =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

export default defineAssets({
  ground: createGroundFloor(),
  backdrop: createBackdrop(),
  'map-table': createMapTable(),
  'terrain-grid': createTerrainMesh(),
  'terrain-props': createPropMesh(),
  meeple: createMeeple(),
  scroll: createScroll(),
  'quest-card': createCard(),
  chest: createChest(),
  digx: createDigX(),
  beacon: createBeacon(),
  wish: createWishPedestal(),
  haven: createHaven(),
  house: createHouse(),
  relic: createRelic(),
  patron: createPatron(),
  wizard: createWizard(),
  'hud-panel': {
    url: publicAssetUrl('ui/hud.uikitml'),
    type: AssetType.UIKitML,
    name: 'Atlas HUD',
  },
});
