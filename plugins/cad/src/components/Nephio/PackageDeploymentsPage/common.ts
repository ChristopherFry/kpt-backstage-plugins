import { cloneDeep } from 'lodash';
import { PackageRevision } from '../../../types/PackageRevision';
import { PackageSummary } from '../../../utils/packageSummary';
import { Cluster } from './types/cluster';
import { PackageDeployment } from './types/packageDeployment';

export const getDeploymentClusters = (
  deployment: PackageDeployment,
  clusters: Cluster[],
): Cluster[] => {
  const clusterSelector = deployment.spec.selector.matchLabels;

  let selectedClusters = cloneDeep(clusters);

  for (const [selectorKey, selectorValue] of Object.entries(clusterSelector)) {
    selectedClusters = selectedClusters.filter(
      c => c.metadata.labels?.[selectorKey] === selectorValue,
    );
  }

  return selectedClusters;
};

export const getDeploymentPackageSummaries = (
  deployment: PackageDeployment,
  clusters: Cluster[],
  summaries: PackageSummary[],
): PackageSummary[] => {
  const repositoryNames = getDeploymentClusters(deployment, clusters).map(
    c => c.repositoryRef.name,
  );

  const packageName =
    deployment.spec.name ||
    deployment.spec.namespace ||
    deployment.metadata.name;

  return summaries.filter(
    s =>
      repositoryNames.includes(s.repository.metadata.name) &&
      s.latestRevision.spec.packageName === packageName,
  );
};

export const getDeploymentUpstreamPackage = (
  deployment: PackageDeployment,
  revisions: PackageRevision[],
): PackageRevision | undefined => {
  return revisions.find(
    r =>
      r.spec.packageName === deployment.spec.packageRef.packageName &&
      r.spec.revision === deployment.spec.packageRef.revision &&
      r.spec.repository === deployment.spec.packageRef.repository,
  );
};
