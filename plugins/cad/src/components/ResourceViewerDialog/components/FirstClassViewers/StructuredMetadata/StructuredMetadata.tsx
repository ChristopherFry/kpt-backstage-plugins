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

import { StructuredMetadataTable } from '@backstage/core-components';
import { diffArrays } from 'diff';
import React from 'react';
import { KubernetesResource } from '../../../../../types/KubernetesResource';
import { loadYaml } from '../../../../../utils/yaml';

export type Metadata = {
  [key: string]: any;
};

type StructuredMetadataProps = {
  yaml: string;
  baseYaml: string;
  getCustomMetadata?: (resource: KubernetesResource) => Metadata;
};

const normalizeMetadata = (metadata: Metadata) => {
  Object.keys(metadata).forEach(key => {
    if (metadata[key] === undefined || metadata[key] === '') {
      delete metadata[key];
    }

    const isObject =
      !Array.isArray(metadata[key]) && typeof metadata[key] === 'object';
    if (isObject) {
      metadata[key] = Object.entries(metadata[key]).map(
        ([thisKey, value]) => `${thisKey} = ${value}`,
      );
    }
  });
};

const getMetadataForResource = (
  yaml: string,
  getCustomMetadata?: (resource: KubernetesResource) => Metadata,
): Metadata => {
  const resource = loadYaml(yaml) as KubernetesResource;

  if (!resource) return {};

  const baseMetadata = {
    name: resource.metadata?.name,
    namespace: resource.metadata?.namespace,
    kind: resource.kind,
    labels: resource.metadata?.labels,
    annotations: resource.metadata?.annotations,
  };

  const customMetadata = getCustomMetadata ? getCustomMetadata(resource) : {};

  const metadata: Metadata = {
    ...baseMetadata,
    ...customMetadata,
  };

  normalizeMetadata(metadata);

  return metadata;
};

export const StructuredMetadata = ({
  yaml,
  baseYaml,
  getCustomMetadata,
}: StructuredMetadataProps) => {
  const completeMetadata = getMetadataForResource(yaml, getCustomMetadata);
  const completeMetadata2 = getMetadataForResource(yaml, getCustomMetadata);
  const baseMetadata = getMetadataForResource(
    baseYaml ?? yaml,
    getCustomMetadata,
  );

  const dropped = { color: 'red' };
  const indicator = { width: '10px', display: 'inline-block' };

  const getAddedSpan = value => (
    <span style={{ color: 'green', display: 'inline-block' }}>
      <span style={indicator}>+</span>
      {value}
    </span>
  );
  const getRemovedSpan = value => (
    <span style={dropped}>
      <span style={indicator}>-</span>
      {value}
    </span>
  );

  Object.keys(completeMetadata).forEach(key => {
    if (Array.isArray(completeMetadata[key])) {
      const value = completeMetadata[key];
      const baseValue = baseMetadata[key];

      const diff = diffArrays(baseValue ?? [], value);
      console.dir(diff);
      const spans: JSX.Element[] = [];

      for (const d of diff) {
        for (const v of d.value) {
          if (d.added) {
            spans.push(getAddedSpan(v));
          } else if (d.removed) {
            spans.push(getRemovedSpan(v));
          } else {
            spans.push(<span>{v}</span>);
          }
        }
      }

      completeMetadata[key] = spans;
    }

    if (typeof completeMetadata[key] === 'string') {
      const value = completeMetadata[key];
      const baseValue = baseMetadata[key];

      if (baseValue === undefined) {
        completeMetadata[key] =
          getAddedSpan(
            value,
          ); /* <span style={{ color: 'green'}}>+ {thisKey} = {value}</span> */
      } else if (baseValue !== value) {
        completeMetadata[key] = (
          <span>
            {getRemovedSpan(baseValue)}
            <div style={{ height: '8px' }} />
            {getAddedSpan(value)}
          </span>
        );
      }
    }
  });

  Object.keys(baseMetadata).forEach(key => {
    if (baseMetadata[key] === undefined || baseMetadata[key] === '') {
      return;
    }

    const isArray = Array.isArray(baseMetadata[key]);
    const isObject = !isArray && typeof baseMetadata[key] === 'object';

    if (isObject) {
      baseMetadata[key] = Object.entries(baseMetadata[key]).map(
        ([thisKey, value]) => {
          const baseValue = completeMetadata2[key]?.[thisKey];

          if (baseValue === undefined) {
            completeMetadata[key].push(
              <span style={dropped}>
                <span style={indicator}>-</span> {thisKey} = {value}
              </span>,
            );
          }
          return;
        },
      );
    } else {

    }
  });

  return <StructuredMetadataTable metadata={completeMetadata} />;
};
