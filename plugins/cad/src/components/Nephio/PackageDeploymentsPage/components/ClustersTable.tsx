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

import { Table, TableColumn } from '@backstage/core-components';
import React, { Fragment, useState } from 'react';
import { Repository } from '../../../../types/Repository';
import { dumpYaml } from '../../../../utils/yaml';
import { RepositoryLink } from '../../../Links';
import { ResourceViewerDialog } from '../../../ResourceViewerDialog';
import { Cluster } from '../types/cluster';

type ClustersTableProps = {
  title?: string;
  clusters: Cluster[];
  repositories: Repository[];
};

type ClusterRow = {
  id: string;
  name: string;
  region: string;
  site: string;
  siteType: string;
  repository?: Repository;
  yaml: string;
};

const getTableColumns = (): TableColumn<ClusterRow>[] => {
  const columns: TableColumn<ClusterRow>[] = [
    { title: 'Name', field: 'name' },
    {
      title: 'Region',
      field: 'region',
    },
    {
      title: 'Site',
      field: 'site',
    },
    {
      title: 'Site Type',
      field: 'siteType',
    },
    {
      title: 'Repository',
      render: row =>
        row.repository ? (
          <RepositoryLink stopPropagation repository={row.repository} />
        ) : (
          <span />
        ),
    },
  ];

  return columns;
};

const mapToClusterRow = (
  cluster: Cluster,
  repositories: Repository[],
): ClusterRow => {
  return {
    id: cluster.metadata.name,
    name: cluster.metadata.name,
    region: cluster.metadata.labels?.['nephio.org/region'] ?? '',
    site: cluster.metadata.labels?.['nephio.org/site'] ?? '',
    siteType: cluster.metadata.labels?.['nephio.org/site-type'] ?? '',
    repository: repositories.find(
      r => r.metadata.name === cluster.repositoryRef.name,
    ),
    yaml: dumpYaml(cluster),
  };
};

export const ClustersTable = ({
  title,
  clusters,
  repositories,
}: ClustersTableProps) => {
  const [clusterYaml, setClusterYaml] = useState<string>();

  const columns = getTableColumns();

  const data = clusters.map(cluster => mapToClusterRow(cluster, repositories));

  return (
    <Fragment>
      <ResourceViewerDialog
        open={!!clusterYaml}
        onClose={() => setClusterYaml(undefined)}
        yaml={clusterYaml}
      />
      <Table
        title={title || 'Clusters'}
        options={{ search: false, paging: false }}
        columns={columns}
        data={data}
        onRowClick={(_, cluster) => {
          if (cluster) {
            setClusterYaml(cluster.yaml);
          }
        }}
      />
    </Fragment>
  );
};
