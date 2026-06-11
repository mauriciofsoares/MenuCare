import { createGovernanceRepository } from './repository.js';

type RouteResult = {
  statusCode: number;
  body: unknown;
};

export interface Deps {
  authenticate: any;
  recommendationPolicyContract: unknown;
}

export const createGovernanceService = (deps: Deps) => {
  const repository = createGovernanceRepository(deps);

  const getRecommendationPolicy = async (): Promise<RouteResult> => ({
    statusCode: 200,
    body: {
      status: 'ok',
      policy: deps.recommendationPolicyContract,
    },
  });

  return {
    repository,
    authenticate: deps.authenticate,
    getRecommendationPolicy,
  };
};
