/**
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createRouteRef, createSubRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'config-as-data',
});

export const registerRepositoryRouteRef = createSubRouteRef({
  id: 'register-repository',
  path: '/repositories/register',
  parent: rootRouteRef,
});

export const repositoryRouteRef = createSubRouteRef({
  id: 'named-repository',
  path: '/repositories/:repositoryName',
  parent: rootRouteRef,
});

export const packagesRouteRef = createSubRouteRef({
  id: 'named-package-content-type',
  path: '/packages/:packageContent',
  parent: rootRouteRef,
});

export const addPackageRouteRef = createSubRouteRef({
  id: 'add-package',
  path: '/packages/:packageContent/add',
  parent: rootRouteRef,
});

export const addPackageToRepoRouteRef = createSubRouteRef({
  id: 'add-package',
  path: '/repositories/:repositoryName/packages/add',
  parent: rootRouteRef,
});

export const packageRouteRef = createSubRouteRef({
  id: 'named-package',
  path: '/repositories/:repositoryName/packages/:packageName',
  parent: rootRouteRef,
});

export const clonePackageRouteRef = createSubRouteRef({
  id: 'clone-package',
  path: '/repositories/:repositoryName/packages/:packageName/clone',
  parent: rootRouteRef,
});

export const editPackageRouteRef = createSubRouteRef({
  id: 'edit-package',
  path: '/repositories/:repositoryName/packages/:packageName/edit',
  parent: rootRouteRef,
});

export const nephioAddPackageDeploymentRouteRef = createSubRouteRef({
  id: 'nephio-add-package-deployment',
  path: '/package-deployments/add',
  parent: rootRouteRef,
});

export const nephioNamedPackageDeploymentRouteRef = createSubRouteRef({
  id: 'nephio-named-package-deployment',
  path: '/package-deployments/:deploymentName',
  parent: rootRouteRef,
});

export const nephioPackageDeploymentsRouteRef = createSubRouteRef({
  id: 'nephio-package-deployments',
  path: '/package-deployments',
  parent: rootRouteRef,
});

export const nephioFiveGTopologiesRouteRef = createSubRouteRef({
  id: 'nephio-topologies',
  path: '/fiveg-topologies',
  parent: rootRouteRef,
});

export const nephioNamedFiveGTopologyRouteRef = createSubRouteRef({
  id: 'nephio-topologies',
  path: '/fiveg-topologies/:coreTopology',
  parent: rootRouteRef,
});
