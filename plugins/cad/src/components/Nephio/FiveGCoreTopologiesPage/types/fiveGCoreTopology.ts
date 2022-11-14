import { KubernetesKeyValueObject } from '../../../../types/KubernetesResource';

export type FiveGCoreTopology = {
  kind: string;
  apiVersion: string;
  metadata: FiveGCoreTopologyMetadata;
  spec: FiveGCoreTopologySpec;
};

export type FiveGCoreTopologyMetadata = {
  name: string;
  namespace?: string;
  labels?: KubernetesKeyValueObject;
  annotations?: KubernetesKeyValueObject;
};

export type FiveGCoreTopologySpec = {
  upfs: UPFS[];
};

export type UPFS = {
  name: string;
  namespace?: string;
  selector: {
    matchLabels: KubernetesKeyValueObject;
  };
  upf: {
    upfClassName: string;
    capacity: {
      uplinkThroughput: string;
      downlinkThroughput: string;
    };
    n3: any[];
    n4: any[];
    n6: any[];
  };
};
