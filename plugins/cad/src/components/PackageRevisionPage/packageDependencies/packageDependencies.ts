import { Deployment } from "../../../types/Deployment";
import { PackageResource } from "../../../utils/packageRevisionResources";
import { loadYaml } from "../../../utils/yaml";

enum RType {
  RESOURCE = 'resource',
  CRD = 'crd',
  IMAGE = 'image',
};

export type ResourceRequirement = {
  type: RType.RESOURCE;
  kind: string;
  name: string;
  namespace?: string;
  fulfilled?: boolean;
} | {
  type: RType.CRD,
  groupVersionKind: string;
  fulfilled?: boolean;
} | {
  type: RType.IMAGE,
  image: string;
  fulfilled?: boolean;
};;


export type PackageResourceExtended = PackageResource & {
  requires: ResourceRequirement[];
}

export const getMessage = (requirement: ResourceRequirement): string => {
  switch(requirement.type) {
    case RType.RESOURCE:
      return `${requirement.kind} ${requirement.name} expected`;
    case RType.CRD:
      return `CRD ${requirement.groupVersionKind} must be installed`; 
    case RType.IMAGE:
      return `Image ${requirement.image} must exist`; 
  }

  return '';
}

export const identifyPackageDependencies = (thisPackageResources: PackageResource[]): PackageResourceExtended[] => {

  const packageResources = thisPackageResources.map(r => ({ ...r, requires: [] }));

  for(const resource of packageResources) {
    addNamespaceRequirement(resource);
    addCRDRequirement(resource);
    addDeploymentRequirements(resource);
  };

  for(const resource of packageResources) {
    for(const req of resource.requires) {
      fulfillResourceRequirement(req, packageResources);
    }
  }

  return packageResources;
};


const addNamespaceRequirement = (resource: PackageResourceExtended): void => {
  if (resource.namespace) {
    resource.requires.push({ type: RType.RESOURCE, kind: 'Namespace', name: resource.namespace })
  }
};

const addDeploymentRequirements = (resource: PackageResourceExtended): void => {
  if (resource.kind === 'Deployment') {
    const deployment = loadYaml(resource.yaml) as Deployment;

    deployment.spec.template.spec.containers.forEach(c => c.env?.forEach(e => {
      const secretName = e.valueFrom?.secretKeyRef?.name;

      if (secretName) {
        resource.requires.push({ type: RType.RESOURCE, kind: 'Secret', name: secretName, namespace: resource.namespace });
      }
    }));


    deployment.spec.template.spec.containers.forEach(c => {
      const image = c.image;

      if (image) {
        resource.requires.push({ type: RType.IMAGE, image: image });
      }
    });

    const sa = deployment.spec.template.spec.serviceAccountName;

    if (sa) {
      resource.requires.push({ type: RType.RESOURCE, kind: 'ServiceAccount', name: sa, namespace: resource.namespace });

    }

  }
}

const fulfillResourceRequirement = (requirement: ResourceRequirement, allResources: PackageResourceExtended[]): void => {
  if (requirement.type !== RType.RESOURCE) return;

  const thisResource = allResources.find(r => requirement.name === r.name && requirement.kind === r.kind);

  if (thisResource) {
    requirement.fulfilled = true;
  }
}

const addCRDRequirement = (resource: PackageResourceExtended): void => {
  const { apiVersion, kind, isLocalConfig } = resource;


  if (!isLocalConfig && apiVersion.includes('/')) {
    const [group] = apiVersion.split('/');

    if (group !== 'apps' && group !== 'rbac.authorization.k8s.io') {
      resource.requires.push({ type: RType.CRD, groupVersionKind: `${apiVersion}/${kind}`});
    }
  }
};

const addPodTemplateRequirements = (resource: PackageResourceExtended): void => {
  const { kind } = resource;

  // Example External Dependencies - Ports, Configs, Secret Refs, etc
};

/*
  namespaceCheck(packageResources);

  const namespaceCheck = (packageResources: PackageResource[]) => {
  const namespacesInPackage = uniq(packageResources.filter(r => !!r.namespace).map(r => r.namespace));

  const namespacesDefined = packageResources.filter(r => r.kind === 'Namespace').map(r => r.name);

  const namespacesRequired = namespacesInPackage.filter(namespace => !namespacesDefined.includes(namespace as string));


  console.log('namespaces that must be provisioned - ', namespacesRequired.join(', '));  // must be provisioned
  // return namespacesRequired;


}
*/

