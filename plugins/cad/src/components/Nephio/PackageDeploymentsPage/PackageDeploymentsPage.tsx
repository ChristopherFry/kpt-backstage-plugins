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
  Button,
  ContentHeader,
  Progress,
  Tabs,
} from '@backstage/core-components';
import { useApi, useRouteRef } from '@backstage/core-plugin-api';
import { Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import React, { useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { configAsDataApiRef } from '../../../apis';
import { nephioAddPackageDeploymentRouteRef } from '../../../routes';
import { PackageRevision } from '../../../types/PackageRevision';
import { Repository } from '../../../types/Repository';
import { LandingPageLink } from '../../Links';
import { ClustersTable } from './components/ClustersTable';
import { PackageDeploymentsTable } from './components/PackageDeploymentsTable';
import { Cluster } from './types/cluster';
import { PackageDeployment } from './types/packageDeployment';

export const PackageDeploymentsPage = () => {
  const api = useApi(configAsDataApiRef);
  const addPackageDeploymentRef = useRouteRef(
    nephioAddPackageDeploymentRouteRef,
  );

  const [deployments, setDeployments] = useState<PackageDeployment[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [revisions, setRevisions] = useState<PackageRevision[]>([]);

  const { loading, error } = useAsync(async (): Promise<void> => {
    const [
      allRevisions,
      { items: allRepositories },
      { items: allDeployments },
      { items: allClusters },
    ] = await Promise.all([
      api.listPackageRevisions(),
      api.listRepositories(),
      api.listNamespacedCustomResources<PackageDeployment>(
        'automation.nephio.org/v1alpha1',
        'packagedeployments',
      ),
      api.listNamespacedCustomResources<Cluster>(
        'infra.nephio.org/v1alpha1',
        'clusters',
      ),
    ]);

    setDeployments(allDeployments);
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

  const title = 'Package Deployments';

  return (
    <div>
      <Breadcrumbs>
        <LandingPageLink breadcrumb />
        <Typography>{title}</Typography>
      </Breadcrumbs>

      <ContentHeader title={title}>
        <Button
          to={addPackageDeploymentRef()}
          color="primary"
          variant="contained"
        >
          Add Package Deployment
        </Button>
      </ContentHeader>

      <Tabs
        tabs={[
          {
            label: 'Package Deployments',
            content: (
              <PackageDeploymentsTable
                deployments={deployments}
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
