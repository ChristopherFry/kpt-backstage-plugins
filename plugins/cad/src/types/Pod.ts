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

import { KubernetesKeyValueObject } from './KubernetesResource';

export type PodTemplateSpec = {
  metadata: PodMetadata;
  spec: PodSpec;
};

export type PodMetadata = {
  name: string;
  namespace?: string;
  labels?: KubernetesKeyValueObject;
  annotations?: KubernetesKeyValueObject;
};

export type PodSpec = {
  serviceAccountName?: string;
  volumes: Volume[];
  containers: Container[];
};

export type Volume = {
  name: string;
  persistentVolumeClaim?: PersistentVolumeClaimVolumeSource;
  configMap?: ConfigMapVolumeSource;
  emptyDir?: EmptyDirVolumeSource;
  secret?: SecretVolumeSource;
};

export type PersistentVolumeClaimVolumeSource = {
  claimName: string;
};

export type ConfigMapVolumeSource = {
  name: string;
};

export type EmptyDirVolumeSource = {};

export type SecretVolumeSource = {
  secretName?: string;
};

export type Container = {
  name: string;
  image?: string;
  command?: string[];
  args?: string[];
  ports?: ContainerPort[];
  volumeMounts?: VolumeMount[];
  env?: Env[]; // CHRIS ADD
};

export type ContainerPort = {
  name: string;
  containerPort: number;
  protocol?: string;
};

export type VolumeMount = {
  name: string;
  mountPath: string;
  readOnly?: boolean;
};

export type Env = {
  name: string;
  valueFrom?: {
    secretKeyRef: SecretKeyRef
  };
}
export type SecretKeyRef = {
  name: string;
};
