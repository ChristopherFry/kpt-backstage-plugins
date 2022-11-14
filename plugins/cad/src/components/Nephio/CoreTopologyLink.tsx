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

import { Link } from '@backstage/core-components';
import { useRouteRef } from '@backstage/core-plugin-api';
import React from 'react';
import { nephioNamedFiveGTopologyRouteRef } from '../../routes';
import { useLinkStyles } from '../Links/styles';

type CoreTopologyLinkProps = {
  topologyName: string;
  breadcrumb?: boolean;
  stopPropagation?: boolean;
};

export const CoreTopologyLink = ({
  breadcrumb,
  topologyName,
  stopPropagation,
}: CoreTopologyLinkProps) => {
  const coreTopologyRef = useRouteRef(nephioNamedFiveGTopologyRouteRef);

  const classes = useLinkStyles();
  const className = breadcrumb ? classes.breadcrumb : '';

  return (
    <Link
      className={className}
      onClick={e => {
        if (stopPropagation) {
          e.stopPropagation();
        }
      }}
      to={coreTopologyRef({ coreTopology: topologyName })}
    >
      {topologyName}
    </Link>
  );
};
