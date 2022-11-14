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

import {
  Breadcrumbs,
  ContentHeader,
  Progress,
  Tabs,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import React, { useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { configAsDataApiRef } from '../../../apis';
import { PackageRevision } from '../../../types/PackageRevision';
import { Repository } from '../../../types/Repository';
import { LandingPageLink } from '../../Links';
import { ClustersTable } from '../PackageDeploymentsPage/components/ClustersTable';
import { Cluster } from '../PackageDeploymentsPage/types/cluster';
import { CoreTopologiesTable } from './components/CoreTopologiesTable';
import { FiveGCoreTopology } from './types/fiveGCoreTopology';

export const FiveGCoreTopologiesPage = () => {
  const api = useApi(configAsDataApiRef);

  const [coreTopologies, setCoreTopologies] = useState<FiveGCoreTopology[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [revisions, setRevisions] = useState<PackageRevision[]>([]);

  const { loading, error } = useAsync(async (): Promise<void> => {
    const [
      allRevisions,
      { items: allRepositories },
      { items: allCoreTopologies },
      { items: allClusters },
    ] = await Promise.all([
      api.listPackageRevisions(),
      api.listRepositories(),
      api.listNamespacedCustomResources<FiveGCoreTopology>(
        'nf.nephio.org/v1alpha1',
        'fivegcoretopologies',
      ),
      api.listNamespacedCustomResources<Cluster>(
        'infra.nephio.org/v1alpha1',
        'clusters',
      ),
    ]);

    setCoreTopologies(allCoreTopologies);
    setClusters(allClusters);
    setRepositories(allRepositories);
    setRevisions(allRevisions);
  }, []);

  if (loading) {
    return <Progress />;
  }
  if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }

  const title = '5G Core Topologies';

  return (
    <div>
      <Breadcrumbs>
        <LandingPageLink breadcrumb />
        <Typography>{title}</Typography>
      </Breadcrumbs>

      <ContentHeader title={title} />

      <Tabs
        tabs={[
          {
            label: 'Core Toplogies',
            content: (
              <CoreTopologiesTable
                coreTopologies={coreTopologies}
                clusters={clusters}
                revisions={revisions}
              />
            ),
          },
          {
            label: 'Clusters',
            content: (
              <ClustersTable clusters={clusters} repositories={repositories} />
            ),
          },
        ]}
      />
    </div>
  );
};
