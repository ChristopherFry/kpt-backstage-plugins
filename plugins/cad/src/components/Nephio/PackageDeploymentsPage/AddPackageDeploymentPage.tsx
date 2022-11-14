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
  Progress,
  SelectItem,
  SimpleStepper,
  SimpleStepperStep,
} from '@backstage/core-components';
import { errorApiRef, useApi, useRouteRef } from '@backstage/core-plugin-api';
import { makeStyles, TextField, Typography } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { cloneDeep, uniq } from 'lodash';
import React, { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAsync from 'react-use/lib/useAsync';
import { configAsDataApiRef } from '../../../apis';
import { nephioNamedPackageDeploymentRouteRef } from '../../../routes';
import { KubernetesKeyValueObject } from '../../../types/KubernetesResource';
import { PackageRevision } from '../../../types/PackageRevision';
import { Repository } from '../../../types/Repository';
import {
  getPackageSummaries,
  PackageSummary,
} from '../../../utils/packageSummary';
import {
  ContentSummary,
  getPackageDescriptor,
} from '../../../utils/repository';
import { getRepositorySummaries } from '../../../utils/repositorySummary';
import { Autocomplete, Select } from '../../Controls';
import { LandingPageLink } from '../../Links';
import { PackageDeploymentsLink } from '../PackageDeploymentsLink';
import { Cluster } from './types/cluster';
import { PackageDeployment } from './types/packageDeployment';

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

type RepositorySelectItem = SelectItem & {
  repository?: Repository;
};

type PackageRevisionSelectItem = SelectItem & {
  packageRevision?: PackageRevision;
};

const mapRepositoryToSelectItem = (
  repository: Repository,
): RepositorySelectItem => ({
  label: repository.metadata.name,
  value: repository.metadata.name,
  repository: repository,
});

const mapPackageRevisionToSelectItem = (
  packageRevision: PackageRevision,
): PackageRevisionSelectItem => ({
  label: packageRevision.spec.packageName,
  value: packageRevision.metadata.name,
  packageRevision: packageRevision,
});

const getActions = (): SelectItem[] => {
  return [
    {
      label: 'Deploy a team blueprint across a number of clusters',
      value: ContentSummary.TEAM_BLUEPRINT,
    },
    {
      label: 'Deploy a organizational blueprint across a number of clusters',
      value: ContentSummary.ORGANIZATIONAL_BLUEPRINT,
    },
    {
      label: 'Deploy a external blueprint across a number of clusters',
      value: ContentSummary.EXTERNAL_BLUEPRINT,
    },
  ];
};

export const AddPackageDeploymentPage = () => {
  const api = useApi(configAsDataApiRef);
  const errorApi = useApi(errorApiRef);

  const classes = useStyles();
  const navigate = useNavigate();
  const packageDeploymentRef = useRouteRef(
    nephioNamedPackageDeploymentRouteRef,
  );

  const refAllRepositories = useRef<Repository[]>([]);
  const refAllPackageSummaries = useRef<PackageSummary[]>([]);
  const refAllClusters = useRef<Cluster[]>([]);

  const [activeStep, setActiveStep] = useState<number>(0);
  const [isCreatingPackageDeployment, setIsCreatingPackageDeployment] =
    useState<boolean>(false);
  const [actionSelectItems] = useState<SelectItem[]>(getActions());
  const [action, setAction] = useState<string>('');
  const [revisionSelectItems, setRevisionSelectItems] = useState<
    PackageRevisionSelectItem[]
  >([]);

  const [sourceRepositorySelectItems, setSourceRepositorySelectItems] =
    useState<RepositorySelectItem[]>([]);
  const [sourceRepository, setSourceRepository] = useState<Repository>();

  const [packageReference, setPackageReference] = useState<PackageRevision>();
  const [packageDeploymentName, setPackageDeploymentName] =
    useState<string>('');
  const [deploymentName, setDeploymentName] = useState<string>('');
  const [clusterSelector, setClusterSelector] =
    useState<KubernetesKeyValueObject>({});

  const clusterRegionOptions = uniq(
    refAllClusters.current
      .map(c => c.metadata.labels?.['nephio.org/region'])
      .filter(c => !!c),
  );
  const clusterSiteOptions = uniq(
    refAllClusters.current
      .map(c => c.metadata.labels?.['nephio.org/site'])
      .filter(c => !!c),
  );
  const clusterSiteTypeOptions = uniq(
    refAllClusters.current
      .map(c => c.metadata.labels?.['nephio.org/site-type'])
      .filter(c => !!c),
  );

  const { loading, error } = useAsync(async (): Promise<void> => {
    const [{ items: allRepositories }, { items: allClusters }, allRevisions] =
      await Promise.all([
        api.listRepositories(),
        api.listNamespacedCustomResources<Cluster>(
          'infra.nephio.org/v1alpha1',
          'clusters',
        ),
        api.listPackageRevisions(),
      ]);

    const fromSummaries = getRepositorySummaries(allRepositories).filter(
      s => !s.repository.spec.deployment,
    );

    const packageSummaries = getPackageSummaries(
      allRevisions,
      fromSummaries,
      allRepositories,
    );

    refAllClusters.current = allClusters;
    refAllRepositories.current = allRepositories;
    refAllPackageSummaries.current = packageSummaries;

    setAction(ContentSummary.ORGANIZATIONAL_BLUEPRINT);
  }, [api]);

  useEffect(() => {
    const thisRepositories = refAllRepositories.current.filter(
      r => getPackageDescriptor(r) === action,
    );

    const selectItems = thisRepositories.map(mapRepositoryToSelectItem);

    setSourceRepositorySelectItems(selectItems);
    setSourceRepository(thisRepositories[0]);
  }, [action]);

  useEffect(() => {
    const publishedRevisions = refAllPackageSummaries.current
      .filter(s => !!s.latestPublishedRevision)
      .filter(
        s => s.repository.metadata.name === sourceRepository?.metadata.name,
      )
      .map(s => s.latestPublishedRevision) as PackageRevision[];

    const selectItems = publishedRevisions.map(mapPackageRevisionToSelectItem);

    setRevisionSelectItems(selectItems);
  }, [sourceRepository]);

  const getPackageDeploymentResource = (): PackageDeployment => {
    if (!packageReference) throw new Error('Package reference is not defined');

    const thisDeployment: PackageDeployment = {
      kind: 'PackageDeployment',
      apiVersion: 'automation.nephio.org/v1alpha1',
      metadata: {
        name: packageDeploymentName,
      },
      spec: {
        name: deploymentName,
        packageRef: {
          packageName: packageReference.spec.packageName,
          revision: packageReference.spec.revision || '',
          repository: packageReference.spec.repository,
        },
        selector: {
          matchLabels: {
            ...clusterSelector,
          },
        },
      },
    };

    return thisDeployment;
  };

  const createPackage = async (): Promise<void> => {
    const resourceJson = getPackageDeploymentResource();

    setIsCreatingPackageDeployment(true);

    try {
      const newResource = await api.createCustomResource(
        'automation.nephio.org/v1alpha1',
        'packagedeployments',
        resourceJson,
      );
      const newDeploymentName = newResource.metadata.name;

      setTimeout(() => {
        navigate(packageDeploymentRef({ deploymentName: newDeploymentName }));
        setIsCreatingPackageDeployment(false);
      }, 5 * 1000);
    } catch (createError) {
      errorApi.post(createError as Error);
      setActiveStep(stepNumber => stepNumber - 1);
      setIsCreatingPackageDeployment(false);
    }
  };

  if (loading || isCreatingPackageDeployment) {
    return <Progress />;
  } else if (error) {
    return <Alert severity="error">{error.message}</Alert>;
  }

  const updateClusterSelector = (key: string, value: string): void => {
    if (value) {
      setClusterSelector(s => ({ ...s, [key]: value || '' }));
    } else {
      setClusterSelector(s => {
        const thisState = cloneDeep(s);
        delete thisState[key];

        return thisState;
      });
    }
  };

  return (
    <div>
      <Fragment>
        <Breadcrumbs>
          <LandingPageLink breadcrumb />
          <PackageDeploymentsLink breadcrumb />
          <Typography>add</Typography>
        </Breadcrumbs>

        <ContentHeader title="Add Package Deployment" />
      </Fragment>

      <SimpleStepper
        activeStep={activeStep}
        onStepChange={(_, next) => setActiveStep(next)}
      >
        <SimpleStepperStep title="Package to deploy">
          <div className={classes.stepContent}>
            <Select
              label="Action"
              onChange={value => setAction(value)}
              selected={action || ''}
              items={actionSelectItems}
              helperText="The action to be taken."
            />

            {sourceRepository && (
              <Fragment>
                <Select
                  label={`Source ${getPackageDescriptor(
                    sourceRepository,
                  )} Repository`}
                  onChange={selectedRepositoryName =>
                    setSourceRepository(
                      sourceRepositorySelectItems.find(
                        r => r.value === selectedRepositoryName,
                      )?.repository,
                    )
                  }
                  selected={sourceRepository?.metadata.name || ''}
                  items={sourceRepositorySelectItems}
                  helperText="The repository that contains the package you want to clone."
                />

                <Select
                  label="Package Reference"
                  onChange={value => {
                    const revision = revisionSelectItems.find(
                      i => i.value === value,
                    )?.packageRevision;
                    if (revision) {
                      setPackageReference(revision);
                      setDeploymentName(revision.spec.packageName);
                      setPackageDeploymentName(revision.spec.packageName);
                    }
                  }}
                  selected={packageReference?.metadata.name ?? ''}
                  items={revisionSelectItems}
                  helperText="The package to deploy across a number of clusters."
                />
              </Fragment>
            )}
          </div>
        </SimpleStepperStep>

        <SimpleStepperStep title="Cluster Selector">
          <div className={classes.stepContent}>
            <Autocomplete
              allowArbitraryValues
              label="Region"
              value={clusterSelector['nephio.org/region'] ?? ''}
              onInputChange={value =>
                updateClusterSelector('nephio.org/region', value)
              }
              options={clusterRegionOptions}
              helperText="The cluster region to deploy the package to. Leave blank to deploy to all regions."
            />
            <Autocomplete
              allowArbitraryValues
              label="Site"
              value={clusterSelector['nephio.org/site'] ?? ''}
              onInputChange={value =>
                updateClusterSelector('nephio.org/site', value)
              }
              options={clusterSiteOptions}
              helperText="The cluster site to deploy the package to. Leave blank to deploy to all regions"
            />
            <Autocomplete
              allowArbitraryValues
              label="Site Type"
              value={clusterSelector['nephio.org/site-type'] ?? ''}
              onInputChange={value =>
                updateClusterSelector('nephio.org/site-type', value)
              }
              options={clusterSiteTypeOptions}
              helperText="The cluste site type to deploy the package to. Leave blank to deploy to all site types."
            />
          </div>
        </SimpleStepperStep>

        <SimpleStepperStep title="Metadata">
          <div className={classes.stepContent}>
            <TextField
              label="Package Deployment Resource Name"
              variant="outlined"
              value={packageDeploymentName}
              name="name"
              onChange={e => setPackageDeploymentName(e.target.value)}
              fullWidth
              helperText="The name of the package deployment resource."
            />

            <TextField
              label="Name"
              variant="outlined"
              value={deploymentName}
              name="name"
              onChange={e => setDeploymentName(e.target.value)}
              fullWidth
              helperText="The name of the deployment resources that will be created by this package deployment."
            />
          </div>
        </SimpleStepperStep>

        <SimpleStepperStep
          title="Confirm"
          actions={{
            nextText: `Create Package Deployment`,
            onNext: createPackage,
          }}
        >
          <div>
            <Typography>
              Confirm creation of{' '}
              <strong>{deploymentName} package deployment</strong>?
            </Typography>
          </div>
        </SimpleStepperStep>
      </SimpleStepper>
    </div>
  );
};
