# Microservices Infra (Work-in-Progress)

This repo now contains service skeletons:

- gateway (port 4000)
- auth-service (4001)
- challenge-service (4002)
- submission-service (4003)
- profile-service (4004)
- interview-service (4005)

Run locally without Docker:

- In each folder, run:
  - npm install
  - npm run dev
- Then hit /health on the corresponding port.

Next steps:
- Add docker-compose.yml with MongoDB, RabbitMQ, and all services.
- Add proxying in gateway to route /auth, /challenges, /submissions, /profile, /interviews.
- Migrate endpoints from monolith backend into these services.
- Add submission-worker to consume queue and execute code via ACE/Judge0.
