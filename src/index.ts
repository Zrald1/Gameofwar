/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { initMapLibrary } from './gen/mapdef.js';
import { HudSystem } from './systems/hud.js';
import { InteractSystem } from './systems/interact.js';
import { MapEditSystem } from './systems/edit.js';
import { NavSystem } from './systems/nav.js';
import { NetAvatarSystem } from './systems/net.js';
import { QuestSystem } from './systems/quests.js';
import { TerrainSystem } from './systems/terrain.js';

const container = document.getElementById('scene-container') as HTMLDivElement;
World.create(container, projectOptions).then(async (world) => {
  container.querySelector('canvas')?.setAttribute('aria-label', 'ATLAS ETERNAL — The Living Map, WebXR viewport');
  await initMapLibrary();
  world.registerSystem(TerrainSystem);
  world.registerSystem(NavSystem);
  world.registerSystem(QuestSystem);
  world.registerSystem(InteractSystem);
  world.registerSystem(MapEditSystem);
  world.registerSystem(NetAvatarSystem);
  world.registerSystem(HudSystem);
});
