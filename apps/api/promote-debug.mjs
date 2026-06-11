import request from "supertest";
import { app } from "./src/server.ts";

const run = async () => {
  await app.ready();
  const login = await request(app.server).post('/auth/login').send({ email: 'admin@menucare.local', password: 'Admin@123' });
  const token = login.body.token;
  const suffix = `dbg-${Date.now()}`;
  const contract = await request(app.server).post('/contracts').set('Authorization', `Bearer ${token}`).field('title', `Contrato ${suffix}`).field('sourceType', 'contract');
  const rule = await request(app.server).post('/rules').set('Authorization', `Bearer ${token}`).send({ contractId: contract.body.contract.id, title: `Regra ${suffix}`, description: 'desc', category: 'operations', sourceExcerpt: 'Trecho de contrato', sourcePage: 1, evidenceConfidence: 0.95, status: 'approved' });
  const promote = await request(app.server).post(`/rules/${rule.body.rule.id}/promote-control`).set('Authorization', `Bearer ${token}`).send({ title: `Controle ${suffix}`, operationalDescription: 'Descricao', frequency: 'daily', responsible: 'Equipe', expectedEvidence: 'Checklist', status: 'ACTIVE' });
  console.log(JSON.stringify({ login: login.status, contract: contract.status, rule: rule.status, promoteStatus: promote.status, promoteBody: promote.body }, null, 2));
  await app.close();
};

run().catch(async (error) => { console.error(error); try { await app.close(); } catch {} process.exit(1); });
