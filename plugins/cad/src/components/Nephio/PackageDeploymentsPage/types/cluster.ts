import { KubernetesKeyValueObject } from '../../../../types/KubernetesResource';

export type Cluster = {
  kind: string;
  apiVersion: string;
  metadata: ClusterMetadata;
  repositoryRef: {
    name: string;
  };
};

export type ClusterMetadata = {
  name: string;
  namespace?: string;
  labels?: KubernetesKeyValueObject;
  annotations?: KubernetesKeyValueObject;
};
