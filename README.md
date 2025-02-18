# TYM-BFF API

This repository contains an **Express.js** backend for a TYM platform. It integrates with a **PostgreSQL** database and provides endpoints for managing users, mentors, mentees, sessions, payments, resumes, reviews, industries, qualifications, and more. The code can run locally as a traditional Node server or be deployed as a serverless function on Vercel.

---

## **Table of Contents**

1. [Features](#features)
2. [Project Structure](#project-structure)
3. [Installation & Setup](#installation--setup)
4. [Running Locally](#running-locally)
5. [Environment Variables](#environment-variables)
6. [API Endpoints](#api-endpoints)
7. [Deployment](#deployment)

---

## Features

- **Users**: Create, view, update, delete user records.
- **Mentors**: Manage mentors, qualifications, expertise, approvals.
- **Mentees**: Store mentee-specific data (education, job roles, experience).
- **Sessions**: Book sessions (1 or multiple mentors, status updates, cancellations).
- **Payments**: Record and update payment info (status, amount).
- **Resumes**: Upload or delete resumes linked to a user; mentors can post reviews.
- **Industries**: Add, remove, and link qualifications/job roles to industries.
- **Many-to-Many** bridging tables**:
    - `mentor_qualifications`
    - `mentor_expertises`
    - `session_mentors`
    - `qualification_industries`
    - `jobrole_industries`

---

## Project Structure

Below is the sample project layout:

```
.
├─ api/
│   └─ index.js           # serverless handler (for Vercel)
├─ src/
│   ├─ app.js            # Exports the Express app (no 'listen' here)
│   ├─ index.js          # Local dev entry (calls app.listen)
│   ├─ lib/
│   │   └─ db.js         # PostgreSQL connection logic
│   ├─ routes/
│   │   ├─ users.js
│   │   ├─ mentors.js
│   │   ├─ mentees.js
│   │   ├─ sessions.js
│   │   ├─ payments.js
│   │   ├─ resumes.js
│   │   ├─ qualifications.js
│   │   ├─ mentorQualifications.js
│   │   ├─ expertises.js
│   │   ├─ mentorExpertises.js
│   │   ├─ jobRoles.js
│   │   └─ ...
│   └─ serverless.js     # or you can rename to 'api/index.js'
├─ package.json
├─ vercel.json           # if needed for routing config
├─ .env                  # environment variables (gitignored)
└─ README.md
```

## Installation & Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/mentor-booking-api.git
   cd mentor-booking-api
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn
   ```

3. Create a local PostgreSQL database or use a managed service.

## Running Locally

1. Add your database credentials to a `.env` file (see [Environment Variables](#environment-variables))

2. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

3. Open `http://localhost:4000` to see a welcome message ("Hello from Express server")

## Environment Variables

Create a `.env` file in the project root (automatically gitignored):

```ini
DATABASE_URL=postgres://username:password@localhost:5432/mentor_db
PORT=4000
```

- `DATABASE_URL`: Points to your Postgres DB
- `PORT`: The local port the server listens on

When deploying to Vercel, set these in Project Settings → Environment Variables.

## API Endpoints

### Users
- `POST /users` - Create a user
- `GET /users` - List all users
- `GET /users/:id` - View user details
- `PATCH /users/:id` - Update user
- `DELETE /users/:id` - Remove user (admin-only)

### Mentors
- `POST /mentors` - Create a mentor profile
- `GET /mentors` - List mentors
- `GET /mentors/:user_id` - View single mentor
- `PUT /mentors/:user_id` - Update
- `DELETE /mentors/:user_id` - Remove (admin)
- `PATCH /mentors/:user_id/approve` - Set mentor's status = "active"

### Mentees
- `POST /mentees` - Create mentee record
- `GET /mentees/:user_id` - View mentee details
- `PUT /mentees/:user_id` - Update mentee

### Qualifications
- `POST /qualifications`
- `GET /qualifications`
- `PUT /qualifications/:id`
- `DELETE /qualifications/:id`

### Mentor-Qualifications (many-to-many)
- `POST /mentors/:user_id/qualifications` - Assign
- `GET /mentors/:user_id/qualifications` - List
- `DELETE /mentors/:user_id/qualifications/:qual_id` - Remove

### Expertises & Mentor_Expertises
- `POST /expertises`, `GET /expertises`, etc.
- `POST /mentors/:user_id/expertises` - Assign
- `DELETE /mentors/:user_id/expertises/:exp_id` - Remove

### Job Roles
- `POST /job-roles`
- `GET /job-roles`
- `PUT /job-roles/:id`
- `DELETE /job-roles/:id`

### Sessions
- `POST /sessions`
- `GET /sessions`
- `GET /sessions/:id`
- `PUT /sessions/:id`
- `DELETE /sessions/:id`
- `POST /sessions/:id/mentors` - Add mentor to session
- `DELETE /sessions/:id/mentors/:mentor_id` - Remove

### Payments
- `POST /payments`
- `GET /payments`
- `GET /payments/:id`
- `PUT /payments/:id`

### Resumes & Reviews
- `POST /resumes`
- `GET /resumes`
- `GET /resumes/:id`
- `DELETE /resumes/:id`
- `POST /resumes/:id/reviews`
- `GET /resumes/:id/reviews`
- `PUT /resumes/:id/reviews/:review_id`
- `DELETE /resumes/:id/reviews/:review_id`

### Industries & Bridging
- `POST /industries`
- `GET /industries`
- `PUT /industries/:id`
- `DELETE /industries/:id`
- `POST /industries/:id/qualifications`
- `DELETE /industries/:id/qualifications/:qual_id`
- `POST /industries/:id/job-roles`
- `DELETE /industries/:id/job-roles/:role_id`

## Deployment

### Local Development
- Run `node src/index.js` or `npm run dev`
- `app.listen(PORT)` starts a server at `http://localhost:4000`

### Render Deployment
1. Create a new Web Service on Render by connecting your Git repository.

2. Configure the build settings in Render dashboard:
    - Build Command: `npm install` (or `npm install && npm run build` if you have a build step)
    - Start Command: `npm run start` (or `node src/index.js`)

3. Set up environment variables:
    - Go to the "Environment" section in your Web Service settings
    - Add your `DATABASE_URL` and any other required environment variables
    - Render automatically sets a `PORT` environment variable

4. Deploy your application:
    - Render will automatically build and deploy your service
    - Monitor the deployment progress and logs in the Render dashboard

5. Access your API:
    - Your API will be available at `https://try-your-mentor-bff.onrender.com/`
    - Example endpoints:
        - `https://try-your-mentor-bff.onrender.com/users/`
        - `https://try-your-mentor-bff.onrender.com//mentors`
        - etc.

Note: Check Render's build logs and real-time logs to debug any deployment or runtime issues. Make sure your code listens on `process.env.PORT` as Render will automatically assign this value.