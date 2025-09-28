// Utility functions
function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
}

function removeToken() {
    localStorage.removeItem('token');
}

function getUser() {
    const token = getToken();
    if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload;
    }
    return null;
}

async function apiRequest(url, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(url, {
        ...options,
        headers
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'API request failed');
    }
    return response.json();
}

// Logout function
function logout() {
    removeToken();
    window.location.href = 'index.html';
}

// Check authentication
function checkAuth() {
    const user = getUser();
    if (!user) {
        window.location.href = 'login.html';
    }
    return user;
}

// Register form
if (document.getElementById('registerForm')) {
    // Show/hide employer fields
    document.getElementById('role').addEventListener('change', () => {
        const role = document.getElementById('role').value;
        const employerFields = document.getElementById('employerFields');
        if (role === 'employer') {
            employerFields.style.display = 'block';
        } else {
            employerFields.style.display = 'none';
        }
    });

    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const role = document.getElementById('role').value;
        const company_name = document.getElementById('company_name')?.value || null;
        const company_description = document.getElementById('company_description')?.value || null;
        try {
            await apiRequest('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ name, email, password, role, company_name, company_description })
            });
            alert('Registration successful! Please login.');
            window.location.href = 'login.html';
        } catch (error) {
            alert(error.message);
        }
    });
}

// Login form
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
            const data = await apiRequest('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            setToken(data.token);
            window.location.href = 'dashboard.html';
        } catch (error) {
            alert(error.message);
        }
    });
}

// Dashboard
if (document.querySelector('.dashboard')) {
    const user = checkAuth();
    document.getElementById('userName').textContent = user.name || 'User';
    if (user.role === 'job_seeker') {
        document.getElementById('jobSeekerDashboard').style.display = 'block';
        loadProfile();
        loadAppliedJobs();
    } else if (user.role === 'employer') {
        document.getElementById('employerDashboard').style.display = 'block';
        document.getElementById('postJobLink').style.display = 'inline';
        loadPostedJobs();
    } else if (user.role === 'admin') {
        document.getElementById('adminDashboard').style.display = 'block';
        // Load analytics by default
        loadAnalytics();
        document.getElementById('analyticsSection').style.display = 'block';
    }
}

async function loadProfile() {
    try {
        const profile = await apiRequest('/api/auth/profile');
        document.getElementById('userNameDisplay').textContent = profile.NAME;
        document.getElementById('userSkills').textContent = profile.SKILLS || 'Not specified';
        document.getElementById('userResume').textContent = profile.RESUME || 'Not specified';
    } catch (error) {
        alert(error.message);
    }
}

async function loadAppliedJobs() {
    try {
        const jobs = await apiRequest('/api/jobs/applied');
        const appliedJobsDiv = document.getElementById('appliedJobs');
        appliedJobsDiv.innerHTML = '';
        if (jobs.length === 0) {
            appliedJobsDiv.innerHTML = '<p>No applied jobs yet.</p>';
        } else {
            jobs.forEach(job => {
                const jobDiv = document.createElement('div');
                jobDiv.className = 'job-card';
                jobDiv.innerHTML = `
                    <h3>${job.TITLE}</h3>
                    <p>${job.DESCRIPTION}</p>
                    <p>Location: ${job.LOCATION}</p>
                    <p>Status: ${job.STATUS}</p>
                `;
                appliedJobsDiv.appendChild(jobDiv);
            });
        }
    } catch (error) {
        alert(error.message);
    }
}

async function loadPostedJobs() {
    try {
        const jobs = await apiRequest('/api/jobs');
        const postedJobsDiv = document.getElementById('postedJobs');
        postedJobsDiv.innerHTML = '';
        jobs.forEach(job => {
            if (job.employer_id === getUser().id) {
                const jobDiv = document.createElement('div');
                jobDiv.className = 'job-card';
                jobDiv.innerHTML = `
                    <h3>${job.TITLE}</h3>
                    <p>${job.DESCRIPTION}</p>
                    <p>Location: ${job.LOCATION}</p>
                    <button onclick="viewApplicants(${job.ID})">View Applicants</button>
                    <button onclick="editJob(${job.ID})">Edit</button>
                    <button onclick="deleteJob(${job.ID})">Delete</button>
                `;
                postedJobsDiv.appendChild(jobDiv);
            }
        });
    } catch (error) {
        alert(error.message);
    }
}

async function viewApplicants(jobId) {
    try {
        const applicants = await apiRequest(`/api/jobs/${jobId}/applicants`);
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>Applicants</h3>
                <div id="applicantsList"></div>
            </div>
        `;
        document.body.appendChild(modal);
        const list = modal.querySelector('#applicantsList');
        applicants.forEach(app => {
            const div = document.createElement('div');
            div.innerHTML = `
                <p>${app.NAME} - ${app.EMAIL} - Skills: ${app.SKILLS} - Status: ${app.STATUS}</p>
                <button onclick="updateStatus(${jobId}, ${app.ID}, 'accepted')">Shortlist</button>
                <button onclick="updateStatus(${jobId}, ${app.ID}, 'rejected')">Reject</button>
            `;
            list.appendChild(div);
        });
        modal.querySelector('.close').onclick = () => modal.remove();
    } catch (error) {
        alert(error.message);
    }
}

async function updateStatus(jobId, appId, status) {
    try {
        await apiRequest(`/api/jobs/${jobId}/applications/${appId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        alert('Status updated');
        // Refresh or close modal
        document.querySelector('.modal').remove();
    } catch (error) {
        alert(error.message);
    }
}

async function loadAnalytics() {
    try {
        const data = await apiRequest('/api/admin/analytics');
        const analyticsDiv = document.getElementById('analytics');
        analyticsDiv.innerHTML = `
            <p>Total Users: ${data.totalUsers}</p>
            <p>Total Jobs: ${data.totalJobs}</p>
            <p>Total Applications: ${data.totalApplications}</p>
        `;
    } catch (error) {
        alert(error.message);
    }
}

async function loadUsers() {
    try {
        const users = await apiRequest('/api/admin/users');
        const usersDiv = document.getElementById('usersList');
        usersDiv.innerHTML = '';
        users.forEach(user => {
            const div = document.createElement('div');
            div.innerHTML = `
                <p>${user.NAME} - ${user.EMAIL} - ${user.ROLE}</p>
                <button onclick="deleteUser(${user.ID})">Delete</button>
            `;
            usersDiv.appendChild(div);
        });
    } catch (error) {
        alert(error.message);
    }
}

async function deleteUser(id) {
    if (confirm('Delete user?')) {
        try {
            await apiRequest(`/api/admin/users/${id}`, { method: 'DELETE' });
            loadUsers();
        } catch (error) {
            alert(error.message);
        }
    }
}

async function loadAdminJobs() {
    try {
        const jobs = await apiRequest('/api/admin/jobs');
        const jobsDiv = document.getElementById('adminJobsList');
        jobsDiv.innerHTML = '';
        jobs.forEach(job => {
            const div = document.createElement('div');
            div.innerHTML = `
                <p>${job.TITLE} by ${job.EMPLOYER_NAME}</p>
                <button onclick="deleteJobAdmin(${job.ID})">Delete</button>
            `;
            jobsDiv.appendChild(div);
        });
    } catch (error) {
        alert(error.message);
    }
}

async function deleteJobAdmin(id) {
    if (confirm('Delete job?')) {
        try {
            await apiRequest(`/api/admin/jobs/${id}`, { method: 'DELETE' });
            loadAdminJobs();
        } catch (error) {
            alert(error.message);
        }
    }
}

// Admin dashboard actions
if (document.getElementById('viewAnalyticsBtn')) {
    document.getElementById('viewAnalyticsBtn').addEventListener('click', () => {
        hideAllSections();
        document.getElementById('analyticsSection').style.display = 'block';
        loadAnalytics();
    });
}

if (document.getElementById('manageUsersBtn')) {
    document.getElementById('manageUsersBtn').addEventListener('click', () => {
        hideAllSections();
        document.getElementById('usersSection').style.display = 'block';
        loadUsers();
    });
}

if (document.getElementById('manageJobsBtn')) {
    document.getElementById('manageJobsBtn').addEventListener('click', () => {
        hideAllSections();
        document.getElementById('jobsSection').style.display = 'block';
        loadAdminJobs();
    });
}

function hideAllSections() {
    document.getElementById('analyticsSection').style.display = 'none';
    document.getElementById('usersSection').style.display = 'none';
    document.getElementById('jobsSection').style.display = 'none';
}

// View More button
if (document.getElementById('viewMoreBtn')) {
    document.getElementById('viewMoreBtn').addEventListener('click', () => {
        const keyword = document.getElementById('keyword')?.value || '';
        const location = document.getElementById('location')?.value || '';
        const salary_min = document.getElementById('salary_min')?.value || '';
        const salary_max = document.getElementById('salary_max')?.value || '';
        const params = {};
        if (keyword) params.keyword = keyword;
        if (location) params.location = location;
        if (salary_min) params.salary_min = salary_min;
        if (salary_max) params.salary_max = salary_max;
        loadJobs(params, true);
    });
}

async function editJob(jobId) {
    // Placeholder for edit functionality
    alert('Edit job functionality not implemented yet.');
}

async function deleteJob(jobId) {
    if (confirm('Are you sure you want to delete this job?')) {
        try {
            await apiRequest(`/api/jobs/${jobId}`, { method: 'DELETE' });
            loadPostedJobs();
        } catch (error) {
            alert(error.message);
        }
    }
}

// Jobs page
let jobsOffset = 0;
const jobsLimit = 10;

if (document.getElementById('jobsList')) {
    checkAuth();
    loadJobs();
}

async function loadJobs(params = {}, append = false) {
    try {
        const queryParams = { ...params, limit: jobsLimit, offset: jobsOffset };
        const query = new URLSearchParams(queryParams).toString();
        const jobs = await apiRequest(`/api/jobs?${query}`);
        const jobsList = document.getElementById('jobsList');
        if (!append) {
            jobsList.innerHTML = '';
            jobsOffset = 0;
        }
        jobs.forEach(job => {
            const jobDiv = document.createElement('div');
            jobDiv.className = 'job-card';
            jobDiv.innerHTML = `
                <h3>${job.TITLE}</h3>
                <p>${job.DESCRIPTION}</p>
                <p>Requirements: ${job.REQUIREMENTS}</p>
                <p>Salary: ${job.SALARY || 'Not specified'}</p>
                <p>Location: ${job.LOCATION}</p>
                <p>Employer: ${job.EMPLOYER_NAME}</p>
                <button onclick="applyToJob(${job.ID})">Apply</button>
            `;
            jobsList.appendChild(jobDiv);
        });
        jobsOffset += jobs.length;
        // Show/hide view more button
        const viewMoreBtn = document.getElementById('viewMoreBtn');
        if (viewMoreBtn) {
            viewMoreBtn.style.display = jobs.length === jobsLimit ? 'block' : 'none';
        }
    } catch (error) {
        alert(error.message);
    }
}

// Search form
if (document.getElementById('searchForm')) {
    document.getElementById('searchForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const keyword = document.getElementById('keyword').value;
        const location = document.getElementById('location').value;
        const salary_min = document.getElementById('salary_min').value;
        const salary_max = document.getElementById('salary_max').value;
        const params = {};
        if (keyword) params.keyword = keyword;
        if (location) params.location = location;
        if (salary_min) params.salary_min = salary_min;
        if (salary_max) params.salary_max = salary_max;
        loadJobs(params, false);
    });
}

async function applyToJob(jobId) {
    try {
        await apiRequest(`/api/jobs/${jobId}/apply`, { method: 'POST' });
        alert('Applied successfully!');
    } catch (error) {
        alert(error.message);
    }
}

// Post job form
if (document.getElementById('postJobForm')) {
    checkAuth();
    document.getElementById('postJobForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;
        const requirements = document.getElementById('requirements').value;
        const salary = document.getElementById('salary').value;
        const location = document.getElementById('location').value;
        try {
            await apiRequest('/api/jobs', {
                method: 'POST',
                body: JSON.stringify({ title, description, requirements, salary, location })
            });
            alert('Job posted successfully!');
            window.location.href = 'dashboard.html';
        } catch (error) {
            alert(error.message);
        }
    });
}

// Logout buttons
document.querySelectorAll('#logout').forEach(btn => {
    btn.addEventListener('click', logout);
});

// Profile edit
if (document.getElementById('editProfileBtn')) {
    document.getElementById('editProfileBtn').addEventListener('click', () => {
        document.getElementById('profileForm').style.display = 'block';
        document.getElementById('profileName').value = document.getElementById('userNameDisplay').textContent;
        document.getElementById('profileSkills').value = document.getElementById('userSkills').textContent === 'Not specified' ? '' : document.getElementById('userSkills').textContent;
        document.getElementById('profileResume').value = document.getElementById('userResume').textContent === 'Not specified' ? '' : document.getElementById('userResume').textContent;
    });
}

if (document.getElementById('cancelEdit')) {
    document.getElementById('cancelEdit').addEventListener('click', () => {
        document.getElementById('profileForm').style.display = 'none';
    });
}

if (document.getElementById('updateProfileForm')) {
    document.getElementById('updateProfileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('profileName').value;
        const skills = document.getElementById('profileSkills').value;
        const resume = document.getElementById('profileResume').value;
        try {
            await apiRequest('/api/auth/profile', {
                method: 'PUT',
                body: JSON.stringify({ name, skills, resume })
            });
            alert('Profile updated!');
            document.getElementById('profileForm').style.display = 'none';
            loadProfile();
        } catch (error) {
            alert(error.message);
        }
    });
}