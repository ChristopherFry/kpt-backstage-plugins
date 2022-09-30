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

import {
  Breadcrumbs,
  ContentHeader,
  Link,
  Progress,
  SelectItem,
  SimpleStepper,
  SimpleStepperStep,
} from '@backstage/core-components';
import { useApi, useRouteRef } from '@backstage/core-plugin-api';
import { makeStyles, TextField, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useAsync from 'react-use/lib/useAsync';
import { ConfigAsDataApi, configAsDataApiRef } from '../../apis';
import { packageRouteRef } from '../../routes';
import { ConfigMap } from '../../types/ConfigMap';
import { Kptfile } from '../../types/Kptfile';
import {
  KubernetesKeyValueObject,
  KubernetesResource,
} from '../../types/KubernetesResource';
import { Namespace } from '../../types/Namespace';
import {
  PackageRevision,
  PackageRevisionLifecycle,
} from '../../types/PackageRevision';
import { PackageRevisionResourcesMap } from '../../types/PackageRevisionResource';
import { Repository } from '../../types/Repository';
import { SetLabels } from '../../types/SetLabels';
import {
  findKptFunctionInPipeline,
  getLatestFunction,
  groupFunctionsByName,
} from '../../utils/function';
import {
  canCloneRevision,
  getCloneTask,
  getInitTask,
  getPackageRevision,
  getPackageRevisionResource,
} from '../../utils/packageRevision';
import {
  addResourceToResourcesMap,
  getPackageResourcesFromResourcesMap,
  getPackageRevisionResourcesResource,
  getRootKptfile,
  PackageResource,
  updateResourceInResourcesMap,
} from '../../utils/packageRevisionResources';
import {
  ContentSummary,
  getPackageDescriptor,
  getRepository,
  RepositoryContentDetails,
} from '../../utils/repository';
import { sortByLabel } from '../../utils/selectItem';
import { emptyIfUndefined, toLowerCase } from '../../utils/string';
import { dumpYaml, loadYaml } from '../../utils/yaml';
import { Checkbox } from '../Controls';
import { Select } from '../Controls/Select';
import { PackageLink, RepositoriesLink, RepositoryLink } from '../Links';

const useStyles = makeStyles(() => ({
  stepContent: {
    maxWidth: '600px',
    '& > *': {
      marginTop: '16px',
    },
  },
  checkboxConditionalElements: {
    marginLeft: '32px',
    marginTop: '8px',
    '& > *': {
      marginTop: '16px',
    },
  },
}));

export enum AddPackagePageAction {
  ADD = 'add',
  CLONE = 'clone',
}

type AddPackagePageProps = {
  action: AddPackagePageAction;
};

type PackageRevisionSelectItem = SelectItem & {
  packageRevision?: PackageRevision;
};

type RepositorySelectItem = SelectItem & {
  repository?: Repository;
};

type KptfileState = {
  name: string;
  description: string;
  keywords: string;
  site: string;
};

type BestPracticesState = {
  setNamespace: boolean;
  createNamespace: boolean;
  namespaceOption: string;
  namespace: string;
  setLabels: boolean;
  applicationNameLabel: string;
  componentLabel: string;
  partOfLabel: string;
  setKubeval: boolean;
};

const mapPackageRevisionToSelectItem = (
  packageRevision: PackageRevision,
): PackageRevisionSelectItem => ({
  label: packageRevision.spec.packageName,
  value: packageRevision.metadata.name,
  packageRevision: packageRevision,
});

const mapRepositoryToSelectItem = (
  repository: Repository,
): RepositorySelectItem => ({
  label: repository.metadata.name,
  value: repository.metadata.name,
  repository: repository,
});

const getPackageResources = async (
  api: ConfigAsDataApi,
  packageName: string,
): Promise<[PackageResource[], PackageRevisionResourcesMap]> => {
  const packageResourcesResponse = await api.getPackageRevisionResources(
    packageName,
  );
  const resourcesMap = packageResourcesResponse.spec.resources;
  const resources = getPackageResourcesFromResourcesMap(resourcesMap);

  return [resources, resourcesMap];
};

const createResource = (
  apiVersion: string,
  kind: string,
  name: string,
  localConfig: boolean = true,
): KubernetesResource => {
  const resource: KubernetesResource = {
    apiVersion: apiVersion,
    kind: kind,
    metadata: {
      name: name,
    },
  };

  if (localConfig) {
    resource.metadata.annotations = {
      'config.kubernetes.io/local-config': 'true',
    };
  }

  return resource;
};

const addPackageResource = (
  packageResources: PackageResource[],
  resource: KubernetesResource,
  filename: string,
): PackageResource => {
  const packageResource: PackageResource = {
    filename: filename,
    yaml: dumpYaml(resource),
  } as PackageResource;

  packageResources.push(packageResource);

  return packageResource;
};

export const AddPackagePage = ({ action }: AddPackagePageProps) => {
  const api = useApi(configAsDataApiRef);
  const classes = useStyles();
  const navigate = useNavigate();

  const { repositoryName, packageName } = useParams();

  const isAddPackageAction = action === AddPackagePageAction.ADD;
  const isCloneNamedPackageAction = !isAddPackageAction;

  const newPackageRevision = 'v1';

  const [addPackageAction, setAddPackageAction] = useState<string>('');
  const [addPackageSelectItems, setAddPackageSelectItems] = useState<
    SelectItem[]
  >([]);

  const allRepositories = useRef<Repository[]>([]);
  const allClonablePackageRevisions = useRef<PackageRevision[]>([]);

  const [targetRepository, setTargetRepository] = useState<Repository>();
  const [sourcePackageRevision, setSourcePackageRevision] =
    useState<PackageRevision>();
  const [sourceRepository, setSourceRepository] = useState<Repository>();

  const [kptfileState, setKptfileState] = useState<KptfileState>({
    name: '',
    description: '',
    keywords: '',
    site: '',
  });

  const [bestPracticesState, setBestPracticesState] =
    useState<BestPracticesState>({
      setNamespace: false,
      createNamespace: false,
      namespaceOption: 'user-defined',
      namespace: '',
      setLabels: false,
      applicationNameLabel: '',
      partOfLabel: '',
      componentLabel: '',
      setKubeval: false,
    });

  const [isCreatingPackage, setIsCreatingPackage] = useState<boolean>(false);

  const [
    sourcePackageRevisionSelectItems,
    setSourcePackageRevisionSelectItems,
  ] = useState<PackageRevisionSelectItem[]>([]);
  const [targetRepositorySelectItems, setTargetRepositorySelectItems] =
    useState<RepositorySelectItem[]>([]);
  const [sourceRepositorySelectItems, setSourceRepositorySelectItems] =
    useState<RepositorySelectItem[]>([]);

  const targetRepositoryPackageDescriptor = targetRepository
    ? getPackageDescriptor(targetRepository)
    : 'Package';
  const sourceRepositoryPackageDescriptor = sourceRepository
    ? getPackageDescriptor(sourceRepository)
    : 'Package';

  const packageRef = useRouteRef(packageRouteRef);

  const targetRepositoryPackageDescriptorLowercase = toLowerCase(
    targetRepositoryPackageDescriptor,
  );
  const sourceRepositoryPackageDescriptorLowercase = toLowerCase(
    sourceRepositoryPackageDescriptor,
  );

  const { loading, error } = useAsync(async (): Promise<void> => {
    const [{ items: thisAllRepositories }, allPackages] = await Promise.all([
      api.listRepositories(),
      api.listPackageRevisions(),
    ]);

    allRepositories.current = thisAllRepositories;
    allClonablePackageRevisions.current = allPackages.filter(canCloneRevision);

    const thisRepository = getRepository(thisAllRepositories, repositoryName);
    const packageDescriptor = getPackageDescriptor(
      thisRepository,
    ) as ContentSummary;

    if (isAddPackageAction) {
      setTargetRepository(thisRepository);
      const packageDescriptorLowerCase = toLowerCase(packageDescriptor);

      const actionSelectItems: SelectItem[] = [
        {
          label: `Create a new ${packageDescriptorLowerCase} from scratch`,
          value: 'none',
        },
      ];

      for (const contentType of Object.keys(RepositoryContentDetails)) {
        const cloneTo = RepositoryContentDetails[contentType].cloneTo;
        const contentTypeLowerCase = toLowerCase(contentType);

        if (cloneTo.includes(packageDescriptor)) {
          actionSelectItems.push({
            label: `Create a new ${packageDescriptorLowerCase} by cloning a ${contentTypeLowerCase}`,
            value: contentType,
          });
        }
      }

      setAddPackageSelectItems(actionSelectItems);
      setAddPackageAction(
        emptyIfUndefined(actionSelectItems?.[0].value as string),
      );
    }

    if (isCloneNamedPackageAction) {
      const thisPackageRevision = getPackageRevision(allPackages, packageName);

      for (const contentType of RepositoryContentDetails[packageDescriptor]
        .cloneTo) {
        addPackageSelectItems.push({
          label: `Create a new ${toLowerCase(contentType)} by cloning the ${
            thisPackageRevision.spec.packageName
          } ${toLowerCase(packageDescriptor)}`,
          value: contentType,
        });
      }

      setSourceRepository(thisRepository);
      setSourcePackageRevision(thisPackageRevision);
      setAddPackageSelectItems(addPackageSelectItems);
      setAddPackageAction(
        emptyIfUndefined(addPackageSelectItems?.[0].value as string),
      );
    }
  }, [api, packageName]);

  useEffect(() => {
    const repositoryFilter = (repository: Repository): boolean =>
      getPackageDescriptor(repository) === addPackageAction;

    const filteredRepositories =
      allRepositories.current.filter(repositoryFilter);

    const repositorySelectItems: RepositorySelectItem[] = sortByLabel(
      filteredRepositories.map(mapRepositoryToSelectItem),
    );

    if (isAddPackageAction) {
      setSourceRepositorySelectItems(repositorySelectItems);
      setSourceRepository(repositorySelectItems[0]?.repository);
      setSourcePackageRevision(undefined);
    }

    if (isCloneNamedPackageAction) {
      setTargetRepositorySelectItems(repositorySelectItems);
      setTargetRepository(repositorySelectItems[0]?.repository);
    }
  }, [addPackageAction, isAddPackageAction, isCloneNamedPackageAction]);

  useEffect(() => {
    if (sourceRepository && isAddPackageAction) {
      const repositoryClonablePackages =
        allClonablePackageRevisions.current.filter(
          packageRevision =>
            packageRevision.spec.repository === sourceRepository.metadata.name,
        );

      const allowPackageRevisions = sortByLabel<PackageRevisionSelectItem>(
        repositoryClonablePackages.map(mapPackageRevisionToSelectItem),
      );

      setSourcePackageRevision(undefined);
      setSourcePackageRevisionSelectItems(allowPackageRevisions);
    }
  }, [sourceRepository, isAddPackageAction, isCloneNamedPackageAction]);

  useEffect(() => {
    if (sourcePackageRevision) {
      const updateKptfileState = async (thisPackageName: string) => {
        const [resources] = await getPackageResources(api, thisPackageName);

        const kptfileResource = getRootKptfile(resources);

        const thisKptfile: Kptfile = loadYaml(kptfileResource.yaml);
        setKptfileState({
          name: emptyIfUndefined(thisKptfile.metadata?.name),
          description: emptyIfUndefined(thisKptfile.info?.description),
          keywords: emptyIfUndefined(thisKptfile.info?.keywords?.join(', ')),
          site: emptyIfUndefined(thisKptfile.info?.site),
        });

        const namespaceMutatorFn = findKptFunctionInPipeline(
          thisKptfile.pipeline?.mutators || [],
          'set-namespace',
        );
        let namespaceOption = '';
        let namespace = '';
        if (namespaceMutatorFn) {
          namespaceOption =
            namespaceMutatorFn.configPath === 'package-context'
              ? 'deployment'
              : 'user-defined';

          if (namespaceOption === 'user-defined') {
            const namespaceConfig = resources.find(
              f =>
                f.filename === namespaceMutatorFn.configPath &&
                f.kind === 'SetNamespace',
            );

            if (namespaceConfig) {
              namespace = loadYaml(namespaceConfig.yaml).namespace;
            }
          }
        }

        const setLabelsMutatorFn = findKptFunctionInPipeline(
          thisKptfile.pipeline?.mutators || [],
          'set-labels',
        );
        let applicationNameLabel = '';
        let partOfLabel = '';
        let componentLabel = '';
        if (setLabelsMutatorFn) {
          const setLabelsConfig = resources.find(
            f =>
              f.filename === setLabelsMutatorFn.configPath &&
              f.kind === 'SetLabels',
          );

          if (setLabelsConfig) {
            const setLabels: SetLabels = loadYaml(setLabelsConfig.yaml);

            applicationNameLabel =
              setLabels.labels['app.kubernetes.io/name'] || '';
            partOfLabel = setLabels.labels['app.kubernetes.io/part-of'] || '';
            componentLabel =
              setLabels.labels['app.kubernetes.io/component'] || '';
          }
        }

        const kubevalValidatorFn = findKptFunctionInPipeline(
          thisKptfile.pipeline?.validators || [],
          'kubeval',
        );

        setBestPracticesState({
          setNamespace: !!namespaceMutatorFn,
          createNamespace: false,
          namespaceOption: namespaceOption,
          namespace: namespace,
          setLabels: !!setLabelsMutatorFn,
          applicationNameLabel: applicationNameLabel,
          partOfLabel: partOfLabel,
          componentLabel: componentLabel,
          setKubeval: !!kubevalValidatorFn,
        });
      };

      updateKptfileState(sourcePackageRevision.metadata.name);
    } else {
      setKptfileState({
        name: '',
        description: '',
        keywords: '',
        site: '',
      });
    }
  }, [api, sourcePackageRevision]);

  const getNewPackageRevisionResource = (): PackageRevision => {
    if (!targetRepository) {
      throw new Error('Target repository is not defined');
    }

    const baseTask = sourcePackageRevision
      ? getCloneTask(sourcePackageRevision.metadata.name)
      : getInitTask(
          kptfileState.description,
          kptfileState.keywords,
          kptfileState.site,
        );

    const tasks = [baseTask];

    const resource: PackageRevision = getPackageRevisionResource(
      targetRepository.metadata.name,
      kptfileState.name,
      newPackageRevision,
      PackageRevisionLifecycle.DRAFT,
      tasks,
    );

    return resource;
  };

  const getDisplayPackageName = (thisPackage?: PackageRevision): string => {
    return thisPackage?.spec.packageName || packageName;
  };

  const applyBestPractices = async (
    resourcesMap: PackageRevisionResourcesMap,
  ): Promise<PackageRevisionResourcesMap> => {
    let resourcesMap2 = resourcesMap;

    if (
      bestPracticesState.setNamespace ||
      bestPracticesState.setLabels ||
      bestPracticesState.setKubeval
    ) {
      const allKptFunctions = await api.listCatalogFunctions();
      const kptFunctions = groupFunctionsByName(allKptFunctions);

      const packageResources =
        getPackageResourcesFromResourcesMap(resourcesMap2);
      const kptfileResource = getRootKptfile(packageResources);

      const kptfileYaml = loadYaml(kptfileResource.yaml) as Kptfile;
      const mutators = kptfileYaml.pipeline?.mutators ?? [];
      const validators = kptfileYaml.pipeline?.validators ?? [];
      const newPackageResources: PackageResource[] = [];

      if (bestPracticesState.setNamespace) {
        const setNamespaceFn = getLatestFunction(kptFunctions, 'set-namespace');

        if (bestPracticesState.createNamespace) {
          const namespaceResource: Namespace = createResource(
            'v1',
            'Namespace',
            'this-namespace',
            false,
          );

          addPackageResource(
            newPackageResources,
            namespaceResource,
            'namespace.yaml',
          );
        }

        if (bestPracticesState.namespaceOption === 'user-defined') {
          const setNamespaceResource = {
            ...createResource(
              'fn.kpt.dev/v1alpha1',
              'SetNamespace',
              'set-namespace',
            ),
            namespace: bestPracticesState.namespace,
          };

          const setNamespacePackageResource = addPackageResource(
            newPackageResources,
            setNamespaceResource,
            'set-namespace.yaml',
          );

          mutators.push({
            image: setNamespaceFn.spec.image,
            configPath: setNamespacePackageResource.filename,
          });
        } else if (bestPracticesState.namespaceOption === 'deployment') {
          mutators.push({
            image: setNamespaceFn.spec.image,
            configPath: 'package-context.yaml',
          });
        }
      }

      if (bestPracticesState.setLabels) {
        const setLabelsFn = getLatestFunction(kptFunctions, 'set-labels');

        const labels: KubernetesKeyValueObject = {};
        if (bestPracticesState.applicationNameLabel)
          labels['app.kubernetes.io/name'] =
            bestPracticesState.applicationNameLabel;
        if (bestPracticesState.componentLabel)
          labels['app.kubernetes.io/component'] =
            bestPracticesState.componentLabel;
        if (bestPracticesState.partOfLabel)
          labels['app.kubernetes.io/part-of'] = bestPracticesState.partOfLabel;

        if (Object.keys(labels).length > 0) {
          const setLabelsResource: SetLabels = {
            ...createResource('fn.kpt.dev/v1alpha1', 'SetLabels', 'set-labels'),
            labels,
          };

          const setLabelsPackageResource = addPackageResource(
            newPackageResources,
            setLabelsResource,
            'set-labels.yaml',
          );

          mutators.push({
            image: setLabelsFn.spec.image,
            configPath: setLabelsPackageResource.filename,
          });
        }
      }

      if (bestPracticesState.setKubeval) {
        const kubevalFn = getLatestFunction(kptFunctions, 'kubeval');

        const kubevalConfigResource: ConfigMap = {
          ...createResource('v1', 'ConfigMap', 'kubeval-config'),
          data: {
            ignore_missing_schemas: 'true',
          },
        };

        const kubevalConfigPackageResource = addPackageResource(
          newPackageResources,
          kubevalConfigResource,
          'kubeval-config.yaml',
        );

        validators.push({
          image: kubevalFn.spec.image,
          configPath: kubevalConfigPackageResource.filename,
        });
      }

      for (const newResource of newPackageResources) {
        resourcesMap2 = addResourceToResourcesMap(resourcesMap2, newResource);
      }

      kptfileYaml.pipeline = {
        ...(kptfileYaml.pipeline ?? {}),
        mutators,
        validators,
      };

      const updatedKptfileYaml = dumpYaml(kptfileYaml);

      resourcesMap2 = updateResourceInResourcesMap(
        resourcesMap2,
        kptfileResource,
        updatedKptfileYaml,
      );
    }

    return resourcesMap2;
  };

  const updateKptfileInfo = (
    resourcesMap: PackageRevisionResourcesMap,
  ): PackageRevisionResourcesMap => {
    const isClonePackageAction = !!sourcePackageRevision;

    if (!isClonePackageAction) {
      return resourcesMap;
    }

    const resources = getPackageResourcesFromResourcesMap(resourcesMap);

    const kptfileResource = getRootKptfile(resources);

    const thisKptfile: Kptfile = loadYaml(kptfileResource.yaml);

    thisKptfile.info.description = kptfileState.description;
    thisKptfile.info.keywords = kptfileState.keywords.trim()
      ? kptfileState.keywords.split(',').map(keyword => keyword.trim())
      : undefined;
    thisKptfile.info.site = kptfileState.site || undefined;

    const updatedKptfileYaml = dumpYaml(thisKptfile);

    const updatedResourceMap = updateResourceInResourcesMap(
      resourcesMap,
      kptfileResource,
      updatedKptfileYaml,
    );

    return updatedResourceMap;
  };

  const updatePackageResources = async (
    newPackageName: string,
  ): Promise<void> => {
    const [_, resourcesMap] = await getPackageResources(api, newPackageName);

    let updatedResourcesMap = await applyBestPractices(resourcesMap);

    updatedResourcesMap = updateKptfileInfo(resourcesMap);

    if (updatedResourcesMap !== resourcesMap) {
      const packageRevisionResources = getPackageRevisionResourcesResource(
        newPackageName,
        updatedResourcesMap,
      );

      await api.replacePackageRevisionResources(packageRevisionResources);
    }
  };

  const createPackage = async (): Promise<void> => {
    const resourceJson = getNewPackageRevisionResource();

    setIsCreatingPackage(true);

    const newPackageRevisionResource = await api.createPackageRevision(
      resourceJson,
    );
    const newPackageRevisionName = newPackageRevisionResource.metadata.name;

    await updatePackageResources(newPackageRevisionName);

    navigate(
      packageRef({
        repositoryName: resourceJson.spec.repository,
        packageName: newPackageRevisionName,
      }),
    );
  };

  if (loading || isCreatingPackage) {
    return <Progress />;
  } else if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }

  return (
    <div>
      {isCloneNamedPackageAction && (
        <Fragment>
          <Breadcrumbs>
            <RepositoriesLink breadcrumb />
            <RepositoryLink
              repository={sourceRepository as Repository}
              breadcrumb
            />
            <PackageLink
              packageRevision={sourcePackageRevision as PackageRevision}
              breadcrumb
            />
            <Typography>clone</Typography>
          </Breadcrumbs>

          <ContentHeader
            title={`Clone ${getDisplayPackageName(sourcePackageRevision)}`}
          />
        </Fragment>
      )}

      {isAddPackageAction && (
        <Fragment>
          <Breadcrumbs>
            <RepositoriesLink breadcrumb />
            <RepositoryLink
              repository={targetRepository as Repository}
              breadcrumb
            />
            <Typography>add</Typography>
          </Breadcrumbs>

          <ContentHeader title={`Add ${targetRepositoryPackageDescriptor}`} />
        </Fragment>
      )}

      <SimpleStepper>
        <SimpleStepperStep title="Action">
          <div className={classes.stepContent}>
            {isCloneNamedPackageAction && (
              <Fragment>
                <Select
                  label="Action"
                  onChange={value => setAddPackageAction(value)}
                  selected={addPackageAction}
                  items={addPackageSelectItems}
                  helperText={`The action to be taken with the ${sourcePackageRevision?.spec.packageName} ${sourceRepositoryPackageDescriptorLowercase}.`}
                />

                <Select
                  label={`Destination ${targetRepositoryPackageDescriptor} Repository`}
                  onChange={selectedRepositoryName =>
                    setTargetRepository(
                      targetRepositorySelectItems.find(
                        r => r.value === selectedRepositoryName,
                      )?.repository,
                    )
                  }
                  selected={emptyIfUndefined(targetRepository?.metadata.name)}
                  items={targetRepositorySelectItems}
                  helperText={`The repository to create the new ${targetRepositoryPackageDescriptorLowercase} in.`}
                />
              </Fragment>
            )}

            {isAddPackageAction && (
              <Fragment>
                <Select
                  label="Action"
                  onChange={value => setAddPackageAction(value)}
                  selected={addPackageAction}
                  items={addPackageSelectItems}
                  helperText={`The action to be taken in creating the new ${targetRepositoryPackageDescriptorLowercase}.`}
                />

                {addPackageAction !== 'none' && (
                  <Fragment>
                    <Select
                      label={`Source ${sourceRepositoryPackageDescriptor} Repository`}
                      onChange={selectedRepositoryName =>
                        setSourceRepository(
                          sourceRepositorySelectItems.find(
                            r => r.value === selectedRepositoryName,
                          )?.repository,
                        )
                      }
                      selected={emptyIfUndefined(
                        sourceRepository?.metadata.name,
                      )}
                      items={sourceRepositorySelectItems}
                      helperText={`The repository that contains the ${sourceRepositoryPackageDescriptorLowercase} you want to clone.`}
                    />

                    <Select
                      label={`${sourceRepositoryPackageDescriptor} to Clone`}
                      onChange={value =>
                        setSourcePackageRevision(
                          sourcePackageRevisionSelectItems.find(
                            p => p.value === value,
                          )?.packageRevision,
                        )
                      }
                      selected={emptyIfUndefined(
                        sourcePackageRevision?.metadata.name,
                      )}
                      items={sourcePackageRevisionSelectItems}
                      helperText={`The ${sourceRepositoryPackageDescriptorLowercase} to clone.`}
                    />
                  </Fragment>
                )}
              </Fragment>
            )}
          </div>
        </SimpleStepperStep>

        <SimpleStepperStep title="Metadata">
          <div className={classes.stepContent}>
            <TextField
              label="Name"
              variant="outlined"
              value={kptfileState.name}
              name="name"
              onChange={e => {
                const thisPackageName = e.target.value;

                if (!sourcePackageRevision) {
                  setBestPracticesState(s => ({
                    ...s,
                    namespace: thisPackageName,
                    applicationNameLabel: thisPackageName,
                  }));
                }
              }}
              fullWidth
              helperText={`The name of the ${targetRepositoryPackageDescriptorLowercase} to create.`}
            />

            <TextField
              label="Description"
              variant="outlined"
              value={kptfileState.description}
              onChange={e =>
                setKptfileState(s => ({
                  ...s,
                  description: e.target.value,
                }))
              }
              fullWidth
              helperText={`The short description of this ${targetRepositoryPackageDescriptorLowercase}.`}
            />

            <TextField
              label="Keywords"
              variant="outlined"
              value={kptfileState.keywords}
              onChange={e =>
                setKptfileState(s => ({ ...s, keywords: e.target.value }))
              }
              fullWidth
              helperText="Optional. Comma separated list of keywords."
            />

            <TextField
              label="Site"
              variant="outlined"
              value={kptfileState.site}
              onChange={e =>
                setKptfileState(s => ({ ...s, site: e.target.value }))
              }
              fullWidth
              helperText={`Optional. The URL for the ${targetRepositoryPackageDescriptorLowercase}'s web page.`}
            />
          </div>
        </SimpleStepperStep>

        <SimpleStepperStep title="Namespace">
          <div className={classes.stepContent}>
            <Checkbox
              label="Set the same namespace for all namespace scoped resources"
              checked={bestPracticesState.setNamespace}
              onChange={isChecked =>
                setBestPracticesState(s => ({
                  ...s,
                  setNamespace: isChecked,
                }))
              }
              helperText="This ensures that all resources have the namespace that can be easily changed in a single place. The namespace can either be static or set to the name of a deployment when a deployment instance is created."
            />

            {bestPracticesState.setNamespace && (
              <div className={classes.checkboxConditionalElements}>
                {!sourcePackageRevision && (
                  <Checkbox
                    label="Add namespace resource to package"
                    checked={bestPracticesState.createNamespace}
                    onChange={isChecked =>
                      setBestPracticesState(s => ({
                        ...s,
                        createNamespace: isChecked,
                      }))
                    }
                    helperText={`If checked, a namespace resource will be added to the ${targetRepositoryPackageDescriptorLowercase}.`}
                  />
                )}

                <Select
                  label="Namespace Option"
                  onChange={value =>
                    setBestPracticesState(s => ({
                      ...s,
                      namespaceOption: value,
                    }))
                  }
                  selected={bestPracticesState.namespaceOption}
                  items={[
                    {
                      label: 'Set specific namespace',
                      value: 'user-defined',
                    },
                    {
                      label:
                        'Set namespace to the name of the deployment instance',
                      value: 'deployment',
                    },
                  ]}
                  helperText="The logic to set the name of the namespace."
                />

                {bestPracticesState.namespaceOption === 'user-defined' && (
                  <TextField
                    label="Namespace"
                    variant="outlined"
                    value={bestPracticesState.namespace}
                    onChange={e =>
                      setBestPracticesState(s => ({
                        ...s,
                        namespace: e.target.value,
                      }))
                    }
                    fullWidth
                    helperText="The namespace all namespace scoped resources will be set to."
                  />
                )}
              </div>
            )}
          </div>
        </SimpleStepperStep>

        <SimpleStepperStep title="Application Labels">
          <div className={classes.stepContent}>
            <Checkbox
              label="Add Kubernetes recommended application labels across all resources"
              checked={bestPracticesState.setLabels}
              onChange={isChecked =>
                setBestPracticesState(s => ({ ...s, setLabels: isChecked }))
              }
              helperText={
                <Fragment>
                  This will add several of the Kubernetes{' '}
                  <Link to="https://kubernetes.io/docs/concepts/overview/working-with-objects/common-labels">
                    recommended labels
                  </Link>{' '}
                  to the resources in the{' '}
                  {targetRepositoryPackageDescriptorLowercase}.
                </Fragment>
              }
            />

            {bestPracticesState.setLabels && (
              <div className={classes.checkboxConditionalElements}>
                <TextField
                  label="Application Name"
                  variant="outlined"
                  value={bestPracticesState.applicationNameLabel}
                  onChange={e =>
                    setBestPracticesState(s => ({
                      ...s,
                      applicationNameLabel: e.target.value,
                    }))
                  }
                  fullWidth
                  helperText="Optional. Name of the application. This will be added as the app.kubernetes.io/name label."
                />

                <TextField
                  label="Component Name"
                  variant="outlined"
                  value={bestPracticesState.componentLabel}
                  onChange={e =>
                    setBestPracticesState(s => ({
                      ...s,
                      componentLabel: e.target.value,
                    }))
                  }
                  fullWidth
                  helperText="Optional. The component within the architecture. This will be added as the app.kubernetes.io/component label."
                />

                <TextField
                  label="Part Of Application"
                  variant="outlined"
                  value={bestPracticesState.partOfLabel}
                  onChange={e =>
                    setBestPracticesState(s => ({
                      ...s,
                      partOfLabel: e.target.value,
                    }))
                  }
                  fullWidth
                  helperText="Optional. The name of a higher level application this one is part of. This will be added as the app.kubernetes.io/part-of label."
                />
              </div>
            )}
          </div>
        </SimpleStepperStep>

        <SimpleStepperStep title="Validate Resources">
          <div className={classes.stepContent}>
            <Checkbox
              label="Validate resources for any OpenAPI schema errors"
              checked={bestPracticesState.setKubeval}
              onChange={isChecked =>
                setBestPracticesState(s => ({ ...s, setKubeval: isChecked }))
              }
              helperText="This validates each resource ensuring it is syntactically correct against its schema. These errors will cause a resource not to deploy to a cluster correctly otherwise. Validation is limited to kubernetes built-in types and GCP CRDs."
            />
          </div>
        </SimpleStepperStep>

        <SimpleStepperStep
          title="Confirm"
          actions={{
            nextText: `Create ${targetRepositoryPackageDescriptor}`,
            onNext: createPackage,
          }}
        >
          <div>
            <Typography>
              Confirm creation of the{' '}
              <strong>
                {kptfileState.name} {targetRepositoryPackageDescriptorLowercase}
              </strong>{' '}
              in the {targetRepository?.metadata.name} repository?
            </Typography>
          </div>
        </SimpleStepperStep>
      </SimpleStepper>
    </div>
  );
};
