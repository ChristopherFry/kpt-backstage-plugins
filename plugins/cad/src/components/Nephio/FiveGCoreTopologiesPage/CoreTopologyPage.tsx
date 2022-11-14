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
import { makeStyles, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import React, { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import useAsync from 'react-use/lib/useAsync';
import { configAsDataApiRef } from '../../../apis';
import { PackageRevision } from '../../../types/PackageRevision';
import { LandingPageLink } from '../../Links';
import { CoreTopologiesLink } from '../CoreTopologiesLink';
import { Cluster } from '../PackageDeploymentsPage/types/cluster';
import { PackageDeployment } from '../PackageDeploymentsPage/types/packageDeployment';
import { CoreTopologiesTable } from './components/CoreTopologiesTable';
import { UpfsTable } from './components/UpfsTable';
import { FiveGCoreTopology } from './types/fiveGCoreTopology';
import { UPFClass } from './types/upfClass';

const useStyles = makeStyles({
  tab: {
    '& > *:not(:last-child)': {
      marginBottom: '24px',
    },
  },
});

export const CoreTopologyPage = () => {
  const api = useApi(configAsDataApiRef);
  const classes = useStyles();

  const refAllUPFClasses = useRef<UPFClass[]>([]);

  const { coreTopology: coreTopologyName } = useParams();

  const [coreTopology, setCoreTopology] = useState<FiveGCoreTopology>();
  const [clusters, setClusters] = useState<Cluster[]>([]);

  const [revisions, setRevisions] = useState<PackageRevision[]>([]);
  const [packageDeployments, setPackageDeployments] = useState<
    PackageDeployment[]
  >([]);

  const { loading, error } = useAsync(async (): Promise<void> => {
    const [
      allRevisions,
      { items: allCoreTopologies },
      { items: allClusters },
      { items: allDeployments },
      { items: allUPFClasses },
    ] = await Promise.all([
      api.listPackageRevisions(),
      api.listNamespacedCustomResources<FiveGCoreTopology>(
        'nf.nephio.org/v1alpha1',
        'fivegcoretopologies',
      ),
      api.listNamespacedCustomResources<Cluster>(
        'infra.nephio.org/v1alpha1',
        'clusters',
      ),
      api.listNamespacedCustomResources<PackageDeployment>(
        'automation.nephio.org/v1alpha1',
        'packagedeployments',
      ),
      api.listClusterCustomResources<UPFClass>(
        'nf.nephio.org/v1alpha1',
        'upfclasses',
      ),
    ]);

    const thisTopology = allCoreTopologies.find(
      c => c.metadata.name === coreTopologyName,
    );

    if (!thisTopology) {
      throw new Error(`Topology not found`);
    }

    refAllUPFClasses.current = allUPFClasses;
    setCoreTopology(thisTopology);
    setClusters(allClusters);
    setRevisions(allRevisions);
    setPackageDeployments(
      allDeployments.filter(
        d =>
          d.metadata.annotations?.['nf.nephio.org/topology'] ===
          coreTopologyName,
      ),
    );
  }, []);

  if (loading) {
    return <Progress />;
  }
  if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }

  if (!coreTopology) {
    throw new Error('No topology');
  }

  const title = coreTopologyName;

  return (
    <div>
      <Breadcrumbs>
        <LandingPageLink breadcrumb />
        <CoreTopologiesLink breadcrumb />
        <Typography>{title}</Typography>
      </Breadcrumbs>

      <ContentHeader title={title} />

      <Tabs
        tabs={[
          {
            label: 'Core Topology',
            content: (
              <div className={classes.tab}>
                <CoreTopologiesTable
                  coreTopologies={[coreTopology]}
                  clusters={clusters}
                  revisions={revisions}
                  oneFocus
                />

                <UpfsTable
                  upfs={coreTopology.spec.upfs}
                  packageDeployments={packageDeployments}
                  clusters={clusters}
                  revisions={revisions}
                  upfClasses={refAllUPFClasses.current}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};
