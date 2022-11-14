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
import { nephioNamedFiveGTopologyRouteRef } from '../../../../routes';
import { PackageRevision } from '../../../../types/PackageRevision';
import { formatCreationTimestamp } from '../../../../utils/formatDate';
import { dumpYaml } from '../../../../utils/yaml';
import { ResourceEditorDialog } from '../../../ResourceEditorDialog';
import { ResourceViewerDialog } from '../../../ResourceViewerDialog';
import { Cluster } from '../../PackageDeploymentsPage/types/cluster';
import { FiveGCoreTopology } from '../types/fiveGCoreTopology';

type OnSaveYamlFn = (yaml: string) => void;

type CoreTopologiesTableProps = {
  title?: string;
  coreTopologies: FiveGCoreTopology[];
  clusters: Cluster[];
  revisions: PackageRevision[];
  oneFocus?: boolean;
  deploymentUpdateFn?: OnSaveYamlFn;
};

type TopologyRow = {
  id: string;
  name: string;
  upfs: string;
  created: string;
  yaml: string;
};

const getTableColumns = (): TableColumn<TopologyRow>[] => {
  const columns: TableColumn<TopologyRow>[] = [
    { title: 'Name', field: 'name' },
    { title: 'UPFS', field: 'upfs' },
    { title: 'Created', field: 'created' },
  ];

  return columns;
};

const mapToTopologyRow = (
  coreTopology: FiveGCoreTopology,
  clusters: Cluster[],
  revisions: PackageRevision[],
): TopologyRow => {
  return {
    id: coreTopology.metadata.name,
    name: coreTopology.metadata.name,
    upfs: (coreTopology.spec.upfs ?? []).map(i => i.name).join(', '),
    created: formatCreationTimestamp(
      (coreTopology.metadata as any).creationTimestamp || '',
    ),
    yaml: dumpYaml(coreTopology),
  };
};

export const CoreTopologiesTable = ({
  title,
  coreTopologies,
  clusters,
  revisions,
  oneFocus,
  deploymentUpdateFn,
}: CoreTopologiesTableProps) => {
  const navigate = useNavigate();
  const coreTopologyRef = useRouteRef(nephioNamedFiveGTopologyRouteRef);
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

  const columns = getTableColumns();

  const data = coreTopologies.map(topology =>
    mapToTopologyRow(topology, clusters, revisions),
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
        title={title || '5G Core Topologies'}
        options={{ search: false, paging: false }}
        columns={columns}
        data={data}
        onRowClick={(_, row) => {
          if (row) {
            if (oneFocus) {
              setYaml(row.yaml);
            } else {
              navigate(coreTopologyRef({ coreTopology: row?.name || '' }));
            }
          }
        }}
      />
    </div>
  );
};
