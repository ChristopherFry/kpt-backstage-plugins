import { KubernetesKeyValueObject } from '../../../../types/KubernetesResource';

export type UPFClass = {
  kind: string;
  apiVersion: string;
  metadata: UPFClassMetadata;
  spec: UPFClassSpec;
};

export type UPFClassMetadata = {
  name: string;
  namespace?: string;
  labels?: KubernetesKeyValueObject;
  annotations?: KubernetesKeyValueObject;
};

export type UPFClassSpec = {
  packageRef: {
    packageName: string;
    revision: string;
    repository: string;
  };
};
