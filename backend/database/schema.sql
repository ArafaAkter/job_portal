-- Oracle 11g SQL script to create job portal database tables

-- Drop tables if exist
DROP TABLE applications CASCADE CONSTRAINTS;
DROP TABLE jobs CASCADE CONSTRAINTS;
DROP TABLE users CASCADE CONSTRAINTS;
DROP SEQUENCE users_seq;
DROP SEQUENCE jobs_seq;
DROP SEQUENCE applications_seq;

-- Create sequences for auto-incrementing IDs
CREATE SEQUENCE users_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE jobs_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE applications_seq START WITH 1 INCREMENT BY 1;

-- Users table
CREATE TABLE users (
    id NUMBER PRIMARY KEY,
    name VARCHAR2(255) NOT NULL,
    email VARCHAR2(255) UNIQUE NOT NULL,
    password VARCHAR2(255) NOT NULL,
    role VARCHAR2(50) NOT NULL CHECK (role IN ('job_seeker', 'employer', 'admin')),
    skills VARCHAR2(1000),
    resume VARCHAR2(500),
    profile_pic VARCHAR2(500),
    company_name VARCHAR2(255),
    company_description VARCHAR2(1000)
);

-- Jobs table
CREATE TABLE jobs (
    id NUMBER PRIMARY KEY,
    employer_id NUMBER NOT NULL,
    title VARCHAR2(255) NOT NULL,
    description VARCHAR2(2000),
    requirements VARCHAR2(2000),
    salary VARCHAR2(100),
    location VARCHAR2(255),
    FOREIGN KEY (employer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Applications table
CREATE TABLE applications (
    id NUMBER PRIMARY KEY,
    job_id NUMBER NOT NULL,
    seeker_id NUMBER NOT NULL,
    status VARCHAR2(50) DEFAULT 'applied' CHECK (status IN ('applied', 'accepted', 'rejected')),
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (seeker_id) REFERENCES users(id) ON DELETE CASCADE
);