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
import { useRouteRef } from '@backstage/core-plugin-api';
import { Button } from '@material-ui/core';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nephioNamedPackageDeploymentRouteRef } from '../../../../routes';
import { PackageRevision } from '../../../../types/PackageRevision';
import { formatCreationTimestamp } from '../../../../utils/formatDate';
import { dumpYaml } from '../../../../utils/yaml';
import { PackageLink } from '../../../Links';
import { ResourceEditorDialog } from '../../../ResourceEditorDialog';
import { ResourceViewerDialog } from '../../../ResourceViewerDialog';
import { CoreTopologyLink } from '../../CoreTopologyLink';
import { getDeploymentClusters, getDeploymentUpstreamPackage } from '../common';
import { Cluster } from '../types/cluster';
import { PackageDeployment } from '../types/packageDeployment';

type OnSaveYamlFn = (yaml: string) => void;

type PackageDeploymentsTableProps = {
  title?: string;
  deployments: PackageDeployment[];
  clusters: Cluster[];
  revisions: PackageRevision[];
  oneFocus?: boolean;
  deploymentUpdateFn?: OnSaveYamlFn;
};

type DeploymentRow = {
  id: string;
  name: string;
  upstreamPackage: string;
  upstreamRevision?: PackageRevision;
  coreTopology?: string;
  clusters: string;
  created: string;
  yaml: string;
};

const getTableColumns = (
  oneFocus: boolean,
  editFn: (yaml: string) => JSX.Element,
): TableColumn<DeploymentRow>[] => {
  const columns: TableColumn<DeploymentRow>[] = [
    { title: 'Name', field: 'name' },
    {
      title: 'Package Reference',
      render: row => {
        if (row.upstreamRevision) {
          return (
            <PackageLink
              packageRevision={row.upstreamRevision}
              stopPropagation
            />
          );
        }

        return <span>{row.upstreamPackage}</span>;
      },
    },
    {
      title: '5G Core Topology',
      render: row => {
        if (row.coreTopology) {
          return (
            <CoreTopologyLink topologyName={row.coreTopology} stopPropagation />
          );
        }

        return <span />;
      },
    },

    {
      title: 'Clusters',
      field: 'clusters',
    },
    { title: 'Created', field: 'created' },
  ];

  if (oneFocus) {
    columns.push({ title: 'Update', render: row => editFn(row.yaml) });
  }

  return columns;
};

const mapToDeploymentRow = (
  deployment: PackageDeployment,
  clusters: Cluster[],
  revisions: PackageRevision[],
): DeploymentRow => {
  const upstream = getDeploymentUpstreamPackage(deployment, revisions);

  return {
    id: deployment.metadata.name,
    name: deployment.metadata.name,
    upstreamPackage: `${deployment.spec.packageRef?.packageName} ${deployment.spec.packageRef?.revision}`,
    coreTopology:
      deployment.metadata.annotations?.['nf.nephio.org/topology'] ?? '',
    clusters: getDeploymentClusters(deployment, clusters)
      .map(c => c.metadata.name)
      .join(', '),
    created: formatCreationTimestamp(
      (deployment.metadata as any).creationTimestamp || '',
    ),
    upstreamRevision: upstream,
    yaml: dumpYaml(deployment),
  };
};

export const PackageDeploymentsTable = ({
  title,
  deployments,
  clusters,
  revisions,
  oneFocus,
  deploymentUpdateFn,
}: PackageDeploymentsTableProps) => {
  const navigate = useNavigate();
  const packageDeploymentRef = useRouteRef(
    nephioNamedPackageDeploymentRouteRef,
  );
  const [yaml, setYaml] = useState<string>();
  const [editYaml, setEditYaml] = useState<string>();

  const getEditLink = (thisYaml: string): JSX.Element => (
    <Button
      color="primary"
      variant="contained"
      onClick={e => {
        e.stopPropagation();
        setEditYaml(thisYaml);
      }}
    >
      Update
    </Button>
  );

  const columns = getTableColumns(!!oneFocus, getEditLink);

  const data = deployments.map(deployment =>
    mapToDeploymentRow(deployment, clusters, revisions),
  );

  return (
    <div>
      <ResourceEditorDialog
        open={!!editYaml}
        onClose={() => setEditYaml(undefined)}
        yaml={editYaml || ''}
        onSaveYaml={newYaml => {
          if (deploymentUpdateFn) deploymentUpdateFn(newYaml);
        }}
        packageResources={[]}
      />
      <ResourceViewerDialog
        open={!!yaml}
        onClose={() => setYaml(undefined)}
        yaml={yaml}
      />
      <Table
        title={title || 'Package Deployments'}
        options={{ search: false, paging: false }}
        columns={columns}
        data={data}
        onRowClick={(_, row) => {
          if (row) {
            if (oneFocus) {
              setYaml(row.yaml);
            } else {
              navigate(
                packageDeploymentRef({ deploymentName: row?.name || '' }),
              );
            }
          }
        }}
      />
    </div>
  );
};
