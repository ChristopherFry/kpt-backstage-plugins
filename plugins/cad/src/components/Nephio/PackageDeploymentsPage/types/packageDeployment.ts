import { KubernetesKeyValueObject } from '../../../../types/KubernetesResource';

export type PackageDeployment = {
  kind: string;
  apiVersion: string;
  metadata: PackageDeploymentMetadata;
  spec: PackageDeploymentSpec;
};

export type PackageDeploymentMetadata = {
  name: string;
  namespace?: string;
  labels?: KubernetesKeyValueObject;
  annotations?: KubernetesKeyValueObject;
};

export type PackageDeploymentSpec = {
  name?: string;
  namespace?: string;
  packageRef: {
    packageName: string;
    revision: string;
    repository: string;
  };
  selector: {
    matchLabels: KubernetesKeyValueObject;
  };
};
