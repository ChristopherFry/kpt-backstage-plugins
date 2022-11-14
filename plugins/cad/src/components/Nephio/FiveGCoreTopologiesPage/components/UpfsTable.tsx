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

import { Link, Table, TableColumn } from '@backstage/core-components';
import { useRouteRef } from '@backstage/core-plugin-api';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nephioNamedFiveGTopologyRouteRef } from '../../../../routes';
import { PackageRevision } from '../../../../types/PackageRevision';
import { dumpYaml } from '../../../../utils/yaml';
import { PackageLink } from '../../../Links';
import { ResourceViewerDialog } from '../../../ResourceViewerDialog';
import { PackageDeploymentLink } from '../../PackageDeploymentLink';
import { Cluster } from '../../PackageDeploymentsPage/types/cluster';
import { PackageDeployment } from '../../PackageDeploymentsPage/types/packageDeployment';
import { UPFS } from '../types/fiveGCoreTopology';
import { UPFClass } from '../types/upfClass';

type OnSaveYamlFn = (yaml: string) => void;

type UpfsTableProps = {
  upfs: UPFS[];
  packageDeployments: PackageDeployment[];
  clusters: Cluster[];
  upfClasses: UPFClass[];
  revisions: PackageRevision[];
  oneFocus?: boolean;
  deploymentUpdateFn?: OnSaveYamlFn;
};

type Row = {
  id: string;
  name: string;
  clusters?: string;
  capacity: string;
  className: string;
  deploymentName?: string;
  upfClassYaml?: string;
  upstreamPackage?: string;
  upstreamPackageRevision?: PackageRevision;
};

const getUpstreamPackage = (
  upfClass: UPFClass,
  revisions: PackageRevision[],
): PackageRevision | undefined => {
  return revisions.find(
    r =>
      r.spec.packageName === upfClass.spec.packageRef.packageName &&
      r.spec.revision === upfClass.spec.packageRef.revision &&
      r.spec.repository === upfClass.spec.packageRef.repository,
  );
};

const mapToRow = (
  upfs: UPFS,
  packageDeployments: PackageDeployment[],
  upfClasses: UPFClass[],
  revisions: PackageRevision[],
): Row => {
  const upfClass = upfClasses.find(
    c => c.metadata.name === upfs.upf.upfClassName,
  );
  const packageRef = upfClass?.spec.packageRef;

  return {
    id: upfs.name,
    name: upfs.name,
    capacity: `Uplink ${upfs.upf.capacity.uplinkThroughput}, Downlink ${upfs.upf.capacity.downlinkThroughput}`,
    className: upfs.upf.upfClassName,
    deploymentName: packageDeployments.find(
      d => d.metadata.annotations?.['nf.nephio.org/cluster-set'] === upfs.name,
    )?.metadata.name,
    upfClassYaml: upfClass ? dumpYaml(upfClass) : '',
    upstreamPackage: packageRef
      ? `${packageRef?.packageName} ${packageRef?.revision}`
      : '',
    upstreamPackageRevision: upfClass
      ? getUpstreamPackage(upfClass, revisions)
      : undefined,
  };
};

export const UpfsTable = ({
  upfs,
  packageDeployments,
  revisions,
  upfClasses,
}: UpfsTableProps) => {
  const navigate = useNavigate();
  const coreTopologyRef = useRouteRef(nephioNamedFiveGTopologyRouteRef);
  const [yaml, setYaml] = useState<string>();

  const getTableColumns = (): TableColumn<Row>[] => {
    const columns: TableColumn<Row>[] = [
      { title: 'Name', field: 'name' },
      { title: 'Capacity', field: 'capacity' },
      {
        title: 'Package Deployment',
        render: row =>
          row.deploymentName ? (
            <PackageDeploymentLink deploymentName={row.deploymentName} />
          ) : (
            <></>
          ),
      },
      {
        title: 'Package Reference',
        render: row =>
          row.upstreamPackageRevision ? (
            <PackageLink packageRevision={row.upstreamPackageRevision} />
          ) : (
            <>{row.upstreamPackage}</>
          ),
      },
      {
        title: 'Class',
        render: row =>
          row.upfClassYaml ? (
            <Link to="" onClick={() => setYaml(row.upfClassYaml)}>
              {row.className}
            </Link>
          ) : (
            <>{row.className}</>
          ),
      },
    ];

    return columns;
  };

  const columns = getTableColumns();

  const data = upfs.map(u =>
    mapToRow(u, packageDeployments, upfClasses, revisions),
  );

  return (
    <div>
      <ResourceViewerDialog
        open={!!yaml}
        onClose={() => setYaml(undefined)}
        yaml={yaml}
      />

      <Table
        title="UPF Configuration Sets"
        options={{ search: false, paging: false }}
        columns={columns}
        data={data}
      />
    </div>
  );
};
