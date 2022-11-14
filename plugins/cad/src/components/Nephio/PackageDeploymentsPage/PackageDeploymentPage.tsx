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
  Link,
  Progress,
  Tabs,
} from '@backstage/core-components';
import { useApi, useRouteRef } from '@backstage/core-plugin-api';
import { makeStyles, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useAsync from 'react-use/lib/useAsync';
import { configAsDataApiRef } from '../../../apis';
import { nephioPackageDeploymentsRouteRef } from '../../../routes';
import { KubernetesResource } from '../../../types/KubernetesResource';
import { PackageRevision } from '../../../types/PackageRevision';
import { Repository } from '../../../types/Repository';
import {
  getPackageSummaries,
  PackageSummary,
} from '../../../utils/packageSummary';
import { getRepositorySummaries } from '../../../utils/repositorySummary';
import { loadYaml } from '../../../utils/yaml';
import { LandingPageLink } from '../../Links';
import { PackagesTable } from '../../PackagesTable';
import { getDeploymentClusters, getDeploymentPackageSummaries } from './common';
import { ClustersTable } from './components/ClustersTable';
import { PackageDeploymentsTable } from './components/PackageDeploymentsTable';
import { PackageDeploymentsLink } from '../PackageDeploymentsLink';
import { Cluster } from './types/cluster';
import { PackageDeployment } from './types/packageDeployment';

const useStyles = makeStyles({
  tab: {
    '& > *:not(:last-child)': {
      marginBottom: '24px',
    },
  },
});

export const PackageDeploymentPage = () => {
  const { deploymentName } = useParams();
  const api = useApi(configAsDataApiRef);
  const classes = useStyles();
  const navigate = useNavigate();
  const packageDeploymentsRef = useRouteRef(nephioPackageDeploymentsRouteRef);

  const [packageDeployment, setPackageDeployment] =
    useState<PackageDeployment>();
  const [deployments, setDeployments] = useState<PackageSummary[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [revisions, setRevisions] = useState<PackageRevision[]>([]);

  const refresh = async (): Promise<void> => {
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

    const thisPackageDeployment = allDeployments.find(
      r => r.metadata.name === deploymentName,
    );

    if (!thisPackageDeployment) throw new Error(`${deploymentName} not found`);

    const allPackageSummaries = getPackageSummaries(
      allRevisions,
      getRepositorySummaries(allRepositories),
      allRepositories,
    );

    setRevisions(allRevisions);
    setRepositories(allRepositories);
    setClusters(getDeploymentClusters(thisPackageDeployment, allClusters));
    setPackageDeployment(thisPackageDeployment);
    setDeployments(
      getDeploymentPackageSummaries(
        thisPackageDeployment,
        allClusters,
        allPackageSummaries,
      ),
    );
  };

  const { loading, error } = useAsync(async (): Promise<void> => {
    await refresh();
  }, []);

  if (loading) {
    return <Progress />;
  }
  if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }

  if (!packageDeployment) {
    throw new Error('Package deployment is not defined');
  }

  const title = packageDeployment.metadata.name;

  const updatePackageDeployment = async (yaml: string): Promise<void> => {
    await api.updateCustomResource(
      'automation.nephio.org/v1alpha1',
      'packagedeployments',
      loadYaml(yaml) as KubernetesResource,
    );
    navigate(packageDeploymentsRef());
  };

  return (
    <div>
      <Breadcrumbs>
        <LandingPageLink breadcrumb />
        <PackageDeploymentsLink breadcrumb />
        <Typography>{title}</Typography>
      </Breadcrumbs>

      <ContentHeader title={title}>
        <Link onClick={_ => refresh()} to="#">
          Refresh Package Deployment
        </Link>
      </ContentHeader>

      <Tabs
        tabs={[
          {
            label: 'Package Deployment',
            content: (
              <div className={classes.tab}>
                <PackageDeploymentsTable
                  title="Package Deployment"
                  deployments={[packageDeployment]}
                  clusters={clusters}
                  revisions={revisions}
                  deploymentUpdateFn={updatePackageDeployment}
                  oneFocus
                />

                <PackagesTable
                  title={`${deployments.length} Deployments`}
                  packages={deployments}
                  showRepositoryColumn
                />

                <ClustersTable
                  title={`${clusters.length} Clusters Selected`}
                  clusters={clusters}
                  repositories={repositories}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};
