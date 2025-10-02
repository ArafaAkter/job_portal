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
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload;
        } catch (error) {
            removeToken();
            return null;
        }
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
    // Ensure URL is absolute - use localhost:3000 as base
    const baseUrl = 'http://localhost:3000';
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    const response = await fetch(fullUrl, {
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
    window.location.href = 'http://localhost:3000/index.html';
}

// Check authentication
function checkAuth() {
    const user = getUser();
    if (!user) {
        window.location.href = 'http://localhost:3000/login.html';
        return null;
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
            window.location.href = 'http://localhost:3000/login.html';
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
        const errorDiv = document.getElementById('errorMessage');
        try {
            const data = await apiRequest('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            setToken(data.token);
            window.location.href = 'http://localhost:3000/dashboard.html';
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        }
    });
}

// Dashboard
if (document.querySelector('.dashboard')) {
    const user = checkAuth();
    if (user) {
        const userNameElement = document.getElementById('userName');
        if (userNameElement) {
            userNameElement.textContent = user.name || 'User';
        }
        if (user.role === 'job_seeker') {
            document.getElementById('jobSeekerDashboard').style.display = 'block';
            loadProfile();
            loadAppliedJobs();
            loadBrowseJobs('browseJobs', 'loadMoreJobsBtn');
            // Section switching
            document.querySelectorAll('#jobSeekerDashboard .nav-item').forEach(button => {
                button.addEventListener('click', () => {
                    const section = button.dataset.section;
                    document.querySelectorAll('#jobSeekerDashboard .nav-item').forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    document.querySelectorAll('#jobSeekerDashboard .section').forEach(sec => sec.classList.remove('active'));
                    document.getElementById(section + '-content').classList.add('active');
                });
            });
        } else if (user.role === 'employer') {
            document.getElementById('employerDashboard').style.display = 'block';
            loadApplicants();
            // Handle post job form
            if (document.getElementById('postJobForm')) {
                document.getElementById('postJobForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const title = document.getElementById('title').value;
                    const company_name = document.getElementById('company_name').value;
                    const description = document.getElementById('description').value;
                    const requirements = document.getElementById('requirements').value;
                    const salary = document.getElementById('salary').value;
                    const location = document.getElementById('location').value;
                    try {
                        await apiRequest('/api/jobs', {
                            method: 'POST',
                            body: JSON.stringify({ title, company_name, description, requirements, salary, location })
                        });
                        alert('Job posted successfully!');
                        document.getElementById('postJobForm').reset();
                        loadPostedJobs(); // Refresh the list
                    } catch (error) {
                        alert(error.message);
                    }
                });
            }
            // Section switching
            document.querySelectorAll('#employerDashboard .nav-item').forEach(button => {
                button.addEventListener('click', () => {
                    const section = button.dataset.section;
                    document.querySelectorAll('#employerDashboard .nav-item').forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    document.querySelectorAll('#employerDashboard .section').forEach(sec => sec.classList.remove('active'));
                    document.getElementById(section + '-content').classList.add('active');
                });
            });
        } else if (user.role === 'admin') {
            document.getElementById('adminDashboard').style.display = 'block';
            // Hide jobs tab for admin
            document.getElementById('jobsTab').style.display = 'none';
            // Show analytics by default
            showSection('analytics');
        }

    // Tab switching
    document.querySelectorAll('[data-tab]').forEach(button => {
        button.addEventListener('click', () => {
            if (button.id === 'logout') {
                logout();
                return;
            }
            const tab = button.dataset.tab;
            document.querySelectorAll('[data-tab]').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            document.getElementById(tab + '-content').classList.add('active');
            if (tab === 'jobs') {
                loadJobsPage();
            }
        });
    });
    }
}

async function loadProfile() {
    try {
        const profile = await apiRequest('/api/auth/profile');
        document.getElementById('userNameDisplay').textContent = profile.NAME;
        document.getElementById('userSkills').textContent = profile.SKILLS || 'Not specified';
        const resumeSpan = document.getElementById('userResume');
        const resume = profile.RESUME || 'Not specified';
        if (resume.startsWith('http')) {
            resumeSpan.innerHTML = `<a href="${resume}" target="_blank">${resume}</a>`;
        } else {
            resumeSpan.textContent = resume;
        }
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
                const status = job.STATUS;
                const statusClass = status === 'accepted' ? 'status-accepted' : status === 'rejected' ? 'status-rejected' : status === 'shortlisted' ? 'status-shortlisted' : status === 'reviewed' ? 'status-reviewed' : 'status-pending';
                jobDiv.innerHTML = `
                    <h3>${job.TITLE}</h3>
                    <p>${job.DESCRIPTION}</p>
                    <p>Location: ${job.LOCATION}</p>
                    <p>Status: <span class="status ${statusClass}">${status}</span></p>
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
        const jobs = await apiRequest('/api/jobs/my-jobs');
        const postedJobsDiv = document.getElementById('postedJobs');
        postedJobsDiv.innerHTML = '';
        if (jobs.length === 0) {
            postedJobsDiv.innerHTML = '<p>No jobs posted yet.</p>';
        } else {
            jobs.forEach(job => {
                const jobDiv = document.createElement('div');
                jobDiv.className = 'job-card';
                const truncatedDesc = truncateText(job.DESCRIPTION, 150);
                jobDiv.innerHTML = `
                    <h3>${job.TITLE}</h3>
                    <div class="job-meta">
                        <span>Salary: ${job.SALARY || 'Not specified'}</span>
                        <span>Location: ${job.LOCATION}</span>
                    </div>
                    <div class="job-description">
                        <p>Company: ${job.COMPANY_NAME || 'Not specified'}</p>
                        <p>${truncatedDesc}</p>
                    </div>
                    <div class="job-actions">
                        <button onclick="viewApplicants(${job.ID})" class="btn-primary">View Applicants</button>
                        <button onclick="editJob(${job.ID})" class="btn-primary">Edit</button>
                        <button onclick="deleteJob(${job.ID})" class="btn-primary">Delete</button>
                        <button onclick="viewJobDetails(${job.ID})" class="btn-primary">View More</button>
                    </div>
                `;
                postedJobsDiv.appendChild(jobDiv);
            });
        }
    } catch (error) {
        alert(error.message);
    }
}

async function loadApplicants() {
    try {
        const applicants = await apiRequest('/api/jobs/applicants');
        const applicantsDiv = document.getElementById('applicantsList');
        applicantsDiv.innerHTML = '';
        if (applicants.length === 0) {
            applicantsDiv.innerHTML = '<p>No applicants yet.</p>';
        } else {
            // Group applicants by job
            const grouped = {};
            applicants.forEach(app => {
                if (!grouped[app.job_title]) {
                    grouped[app.job_title] = [];
                }
                grouped[app.job_title].push(app);
            });
            for (const jobTitle in grouped) {
                const jobDiv = document.createElement('div');
                jobDiv.className = 'job-card';
                jobDiv.innerHTML = `<h3>${jobTitle}</h3>`;
                grouped[jobTitle].forEach(app => {
                    const appDiv = document.createElement('div');
                    appDiv.className = 'applicant-card';
                    appDiv.style.border = '1px solid #ddd';
                    appDiv.style.padding = '1rem';
                    appDiv.style.margin = '0.5rem 0';
                    appDiv.style.borderRadius = '8px';
                    const status = app.STATUS;
                    const statusClass = status === 'accepted' ? 'status-accepted' : status === 'rejected' ? 'status-rejected' : status === 'shortlisted' ? 'status-shortlisted' : status === 'reviewed' ? 'status-reviewed' : 'status-pending';
                    appDiv.innerHTML = `
                        <p><strong>Applicant ID:</strong> ${app.app_id}</p>
                        <p><strong>Email:</strong> ${app.EMAIL}</p>
                        <p><strong>Skills:</strong> ${app.SKILLS || 'Not specified'}</p>
                        <p><strong>Resume:</strong> ${app.RESUME || 'Not specified'}</p>
                        <p><strong>Status:</strong> <span class="status ${statusClass}">${status}</span></p>
                        <div class="job-actions">
                            <button onclick="updateStatus(${app.job_id}, ${app.app_id}, 'reviewed')">Reviewed</button>
                            <button onclick="updateStatus(${app.job_id}, ${app.app_id}, 'shortlisted')">Shortlist</button>
                            <button onclick="updateStatus(${app.job_id}, ${app.app_id}, 'accepted')">Accept</button>
                            <button onclick="updateStatus(${app.job_id}, ${app.app_id}, 'rejected')">Reject</button>
                        </div>
                    `;
                    jobDiv.appendChild(appDiv);
                });
                applicantsDiv.appendChild(jobDiv);
            }
        }
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
                <button onclick="updateStatus(${jobId}, ${app.ID}, 'reviewed')">Reviewed</button>
                <button onclick="updateStatus(${jobId}, ${app.ID}, 'shortlisted')">Shortlist</button>
                <button onclick="updateStatus(${jobId}, ${app.ID}, 'accepted')">Accept</button>
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
        loadApplicants(); // Refresh the list
    } catch (error) {
        alert(error.message);
    }
}

async function loadAnalytics() {
    try {
        const data = await apiRequest('/api/admin/analytics');
        const analyticsDiv = document.getElementById('analytics');
        let html = `
            <div class="analytics-grid">
                <div class="admin-list-item">
                    <strong>${data.totalUsers}</strong>
                    <div>Total Users</div>
                </div>
                <div class="admin-list-item">
                    <strong>${data.totalJobs}</strong>
                    <div>Total Jobs</div>
                </div>
                <div class="admin-list-item">
                    <strong>${data.totalApplications}</strong>
                    <div>Total Applications</div>
                </div>
            </div>
            <div class="analytics-grid">
        `;
        data.usersByRole.forEach(role => {
            html += `<div class="admin-list-item"><strong>${role.COUNT}</strong><div>${role.ROLE}</div></div>`;
        });
        html += `
            </div>
            <div class="analytics-grid">
        `;
        data.applicationsByStatus.forEach(status => {
            html += `<div class="admin-list-item"><strong>${status.COUNT}</strong><div>${status.STATUS}</div></div>`;
        });
        html += `</div>`;
        analyticsDiv.innerHTML = html;
    } catch (error) {
        alert(error.message);
    }
}

async function loadUsers() {
    try {
        const users = await apiRequest('/api/admin/users');
        const usersDiv = document.getElementById('usersList');
        usersDiv.innerHTML = '<ul class="admin-list">';
        users.forEach(user => {
            const li = document.createElement('li');
            li.className = 'admin-list-item';
            li.innerHTML = `
                <div class="item-info">
                    <strong>${user.NAME}</strong> - ${user.EMAIL} (${user.ROLE})
                </div>
                <button onclick="deleteUser(${user.ID})" class="btn-primary">Delete</button>
            `;
            usersDiv.querySelector('.admin-list').appendChild(li);
        });
        usersDiv.innerHTML += '</ul>';
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
        jobsDiv.innerHTML = '<ul class="admin-list">';
        jobs.forEach(job => {
            const li = document.createElement('li');
            li.className = 'admin-list-item';
            li.innerHTML = `
                <div class="item-info">
                    <strong>Job Title: ${job.TITLE}</strong><br>
                    <small>Employer Name: ${job.EMPLOYER_NAME}</small><br>
                    <small>Company Name: ${job.COMPANY_NAME || 'N/A'}</small><br>
                    <small>Company Description: ${job.COMPANY_DESCRIPTION || 'N/A'}</small><br>
                    <small>Description: ${job.DESCRIPTION}</small><br>
                    <small>Requirements: ${job.REQUIREMENTS}</small><br>
                    <small>Salary: ${job.SALARY || 'Not specified'}</small><br>
                    <small>Location: ${job.LOCATION}</small>
                </div>
                <button onclick="editJobAdmin(${job.ID})" class="btn-primary">Edit</button>
                <button onclick="deleteJobAdmin(${job.ID})" class="btn-primary">Delete</button>
            `;
            jobsDiv.querySelector('.admin-list').appendChild(li);
        });
        jobsDiv.innerHTML += '</ul>';
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

// Reports: download CSV or view JSON in preview
async function downloadReport(type, format = 'csv') {
    try {
        const token = getToken();
        const res = await fetch(`${window.location.origin}/api/admin/reports/${type}?format=${format}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (!res.ok) {
            let err;
            try { err = await res.json(); } catch (_) { err = {}; }
            throw new Error(err.error || 'Failed to download report');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ext = format === 'csv' ? 'csv' : 'json';
        a.href = url;
        a.download = `${type}-report.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert(e.message);
    }
}

async function viewReport(type) {
    try {
        const data = await apiRequest(`/api/admin/reports/${type}?format=json`);
        const preview = document.getElementById('reportsPreview');
        if (preview) {
            preview.textContent = JSON.stringify(data, null, 2);
        }
    } catch (e) {
        alert(e.message);
    }
}


async function editUser(id) {
    try {
        const user = await apiRequest(`/api/admin/users/${id}`);
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>Edit User</h3>
                <form id="editUserForm">
                    <label>Name: <input type="text" id="editName" value="${user.NAME}" required></label>
                    <label>Email: <input type="email" id="editEmail" value="${user.EMAIL}" required></label>
                    <label>Role: <select id="editRole">
                        <option value="job_seeker" ${user.ROLE === 'job_seeker' ? 'selected' : ''}>Job Seeker</option>
                        <option value="employer" ${user.ROLE === 'employer' ? 'selected' : ''}>Employer</option>
                        <option value="admin" ${user.ROLE === 'admin' ? 'selected' : ''}>Admin</option>
                    </select></label>
                    <label>Skills: <input type="text" id="editSkills" value="${user.SKILLS || ''}"></label>
                    <label>Resume: <input type="text" id="editResume" value="${user.RESUME || ''}"></label>
                    <div id="editEmployerFields" style="display:${user.ROLE === 'employer' ? 'block' : 'none'}">
                        <label>Company Name: <input type="text" id="editCompanyName" value="${user.COMPANY_NAME || ''}"></label>
                        <label>Company Description: <textarea id="editCompanyDescription">${user.COMPANY_DESCRIPTION || ''}</textarea></label>
                        <label>HR Contact: <input type="text" id="editHrContact" value="${user.HR_CONTACT || ''}"></label>
                    </div>
                    <button type="submit" class="btn-primary">Update</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.close').onclick = () => modal.remove();
        document.getElementById('editRole').addEventListener('change', () => {
            const role = document.getElementById('editRole').value;
            document.getElementById('editEmployerFields').style.display = role === 'employer' ? 'block' : 'none';
        });
        document.getElementById('editUserForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('editName').value;
            const email = document.getElementById('editEmail').value;
            const role = document.getElementById('editRole').value;
            const skills = document.getElementById('editSkills').value;
            const resume = document.getElementById('editResume').value;
            const company_name = document.getElementById('editCompanyName')?.value || null;
            const company_description = document.getElementById('editCompanyDescription')?.value || null;
            const hr_contact = document.getElementById('editHrContact')?.value || null;
            try {
                await apiRequest(`/api/admin/users/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name, email, role, skills, resume, company_name, company_description, hr_contact })
                });
                alert('User updated');
                modal.remove();
                loadUsers();
            } catch (error) {
                alert(error.message);
            }
        });
    } catch (error) {
        alert(error.message);
    }
}

async function editJobAdmin(id) {
    try {
        const job = await apiRequest(`/api/jobs/${id}`);
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h3>Edit Job</h3>
                <form id="editJobAdminForm">
                    <label>Title: <input type="text" id="editAdminTitle" value="${job.TITLE}" required></label>
                    <label>Description: <textarea id="editAdminDescription" required>${job.DESCRIPTION}</textarea></label>
                    <label>Requirements: <textarea id="editAdminRequirements">${job.REQUIREMENTS}</textarea></label>
                    <label>Salary: <input type="text" id="editAdminSalary" value="${job.SALARY}"></label>
                    <label>Location: <input type="text" id="editAdminLocation" value="${job.LOCATION}" required></label>
                    <label>Company Name: <input type="text" id="editAdminCompanyName" value="${job.COMPANY_NAME}"></label>
                    <button type="submit" class="btn-primary">Update</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.close').onclick = () => modal.remove();
        document.getElementById('editJobAdminForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('editAdminTitle').value;
            const description = document.getElementById('editAdminDescription').value;
            const requirements = document.getElementById('editAdminRequirements').value;
            const salary = document.getElementById('editAdminSalary').value;
            const location = document.getElementById('editAdminLocation').value;
            const company_name = document.getElementById('editAdminCompanyName').value;
            try {
                await apiRequest(`/api/admin/jobs/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ title, description, requirements, salary, location, company_name })
                });
                alert('Job updated');
                modal.remove();
                loadAdminJobs();
            } catch (error) {
                alert(error.message);
            }
        });
    } catch (error) {
        alert(error.message);
    }
}

// Admin dashboard actions
function showSection(section) {
    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-section="${section}"]`).classList.add('active');

    // Hide all content sections
    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));

    // Show selected section
    document.getElementById(section + 'Section').classList.add('active');

    // Load content based on section
    if (section === 'users') {
        loadUsers();
    } else if (section === 'jobs') {
        loadAdminJobs();
    } else if (section === 'analytics') {
        loadAnalytics();
    } else if (section === 'reports') {
        showReportTab('downloads'); // Default to downloads tab
    }
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
        loadJobsPage(params, true);
    });
}

// Load more buttons for dashboards
if (document.getElementById('loadMoreJobsBtn')) {
    document.getElementById('loadMoreJobsBtn').addEventListener('click', () => {
        loadBrowseJobs('browseJobs', 'loadMoreJobsBtn', {}, true);
    });
}

if (document.getElementById('employerLoadMoreBtn') && document.getElementById('employerBrowseJobs')) {
    document.getElementById('employerLoadMoreBtn').addEventListener('click', () => {
        loadBrowseJobs('employerBrowseJobs', 'employerLoadMoreBtn', {}, true);
    });
}

if (document.getElementById('adminLoadMoreBtn') && document.getElementById('adminBrowseJobs')) {
    document.getElementById('adminLoadMoreBtn').addEventListener('click', () => {
        loadBrowseJobs('adminBrowseJobs', 'adminLoadMoreBtn', {}, true);
    });
}

async function editJob(jobId) {
    // Fetch job details
    try {
        const job = await apiRequest(`/api/jobs/${jobId}`);
        if (job) {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <section class="form-section">
                        <h2>Edit Job</h2>
                        <form id="editJobForm">
                            <div class="form-group">
                                <label for="editTitle">Title</label>
                                <input type="text" id="editTitle" value="${job.TITLE}" required>
                            </div>
                            <div class="form-group">
                                <label for="editCompanyName">Company Name</label>
                                <input type="text" id="editCompanyName" value="${job.COMPANY_NAME}">
                            </div>
                            <div class="form-group">
                                <label for="editDescription">Description</label>
                                <textarea id="editDescription" required>${job.DESCRIPTION}</textarea>
                            </div>
                            <div class="form-group">
                                <label for="editRequirements">Requirements</label>
                                <textarea id="editRequirements">${job.REQUIREMENTS}</textarea>
                            </div>
                            <div class="form-group">
                                <label for="editSalary">Salary</label>
                                <input type="text" id="editSalary" value="${job.SALARY}">
                            </div>
                            <div class="form-group">
                                <label for="editLocation">Location</label>
                                <input type="text" id="editLocation" value="${job.LOCATION}" required>
                            </div>
                            <button type="submit" class="btn-primary">Update Job</button>
                        </form>
                    </section>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('.close').onclick = () => modal.remove();

            document.getElementById('editJobForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                const title = document.getElementById('editTitle').value;
                const company_name = document.getElementById('editCompanyName').value;
                const description = document.getElementById('editDescription').value;
                const requirements = document.getElementById('editRequirements').value;
                const salary = document.getElementById('editSalary').value;
                const location = document.getElementById('editLocation').value;
                try {
                    await apiRequest(`/api/jobs/${jobId}`, {
                        method: 'PUT',
                        body: JSON.stringify({ title, company_name, description, requirements, salary, location })
                    });
                    alert('Job updated successfully!');
                    modal.remove();
                    loadPostedJobs();
                } catch (error) {
                    alert(error.message);
                }
            });
        }
    } catch (error) {
        alert(error.message);
    }
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
var browseOffsets = {};

if (document.getElementById('jobsList')) {
    updateNav();
    loadJobsPage();
}

function updateNav() {
    const user = getUser();
    const loginLink = document.getElementById('loginLink');
    const registerLink = document.getElementById('registerLink');
    const dashboardLink = document.getElementById('dashboardLink');
    const logout = document.getElementById('logout');
    if (user) {
        if (loginLink) loginLink.style.display = 'none';
        if (registerLink) registerLink.style.display = 'none';
        if (dashboardLink) dashboardLink.style.display = 'inline';
        if (logout) logout.style.display = 'inline';
    } else {
        if (loginLink) loginLink.style.display = 'inline';
        if (registerLink) registerLink.style.display = 'inline';
        if (dashboardLink) dashboardLink.style.display = 'none';
        if (logout) logout.style.display = 'none';
    }
}

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

async function loadJobsPage(params = {}, append = false) {
    try {
        const queryParams = { ...params, limit: jobsLimit, offset: jobsOffset };
        const query = new URLSearchParams(queryParams).toString();
        const jobs = await apiRequest(`/api/jobs?${query}`);
        const jobsList = document.getElementById('jobsList');
        if (!append) {
            jobsList.innerHTML = '';
            jobsOffset = 0;
        }
        const user = getUser();
        jobs.forEach(job => {
            const jobDiv = document.createElement('div');
            jobDiv.className = 'job-card';
            let buttons = '';
            if (user.role === 'job_seeker') {
                buttons = `<button onclick="applyToJob(${job.ID})" class="btn-primary">Apply</button>`;
            } else if (user.role === 'employer' && job.EMPLOYER_ID === user.id) {
                buttons = `
                    <button onclick="editJob(${job.ID})" class="btn-primary">Edit</button>
                    <button onclick="deleteJob(${job.ID})" class="btn-primary">Delete</button>
                `;
            }
            const truncatedDesc = truncateText(job.DESCRIPTION, 150);
            const truncatedReq = truncateText(job.REQUIREMENTS, 100);
            jobDiv.innerHTML = `
                <h3>${job.TITLE}</h3>
                <div class="job-meta">
                    <span>Salary: ${job.SALARY || 'Not specified'}</span>
                    <span>Location: ${job.LOCATION}</span>
                </div>
                <div class="job-description">
                    <p>Company: ${job.COMPANY_NAME || 'Not specified'}</p>
                    <p>${truncatedDesc}</p>
                    ${truncatedReq ? `<p><strong>Requirements:</strong> ${truncatedReq}</p>` : ''}
                </div>
                <div class="job-actions">
                    <button onclick="viewJobDetails(${job.ID})" class="btn-primary">View More</button>
                    ${buttons}
                </div>
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

async function loadBrowseJobs(containerId, buttonId, params = {}, append = false) {
    try {
        const jobsList = document.getElementById(containerId);
        if (!jobsList) return;
        const offset = browseOffsets[containerId] || 0;
        const queryParams = { ...params, limit: 1000, offset: offset };
        const query = new URLSearchParams(queryParams).toString();
        const jobs = await apiRequest(`/api/jobs?${query}`);
        if (!append) {
            jobsList.innerHTML = '';
            browseOffsets[containerId] = 0;
        }
        jobs.forEach(job => {
            const jobDiv = document.createElement('div');
            jobDiv.className = 'job-card';
            const truncatedDesc = truncateText(job.DESCRIPTION, 150);
            const truncatedReq = truncateText(job.REQUIREMENTS, 100);
            jobDiv.innerHTML = `
                <h3>${job.TITLE}</h3>
                <div class="job-meta">
                    <span>Salary: ${job.SALARY || 'Not specified'}</span>
                    <span>Location: ${job.LOCATION}</span>
                </div>
                <div class="job-description">
                    <p>Company: ${job.COMPANY_NAME || 'Not specified'}</p>
                    <p>${truncatedDesc}</p>
                    ${truncatedReq ? `<p><strong>Requirements:</strong> ${truncatedReq}</p>` : ''}
                </div>
                <div class="job-actions">
                    <button onclick="viewJobDetails(${job.ID})" class="btn-primary">View More</button>
                </div>
            `;
            jobsList.appendChild(jobDiv);
        });
        browseOffsets[containerId] = (browseOffsets[containerId] || 0) + jobs.length;
        // Show/hide load more button
        const loadMoreBtn = document.getElementById(buttonId);
        if (loadMoreBtn) {
            loadMoreBtn.style.display = jobs.length === 10 ? 'block' : 'none';
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
        loadJobsPage(params, false);
    });
}

async function viewJobDetails(jobId) {
    try {
        const job = await apiRequest(`/api/jobs/${jobId}`);
        if (job) {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <span class="close">&times;</span>
                    <h3>${job.TITLE}</h3>
                    <p><strong>Company:</strong> ${job.COMPANY_NAME || 'Not specified'}</p>
                    <p><strong>Description:</strong> ${job.DESCRIPTION}</p>
                    <p><strong>Requirements:</strong> ${job.REQUIREMENTS}</p>
                    <p><strong>Salary:</strong> ${job.SALARY || 'Not specified'}</p>
                    <p><strong>Location:</strong> ${job.LOCATION}</p>
                    <p><strong>Employer:</strong> ${job.EMPLOYER_NAME}</p>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('.close').onclick = () => modal.remove();
        }
    } catch (error) {
        alert(error.message);
    }
}

async function applyToJob(jobId) {
    const user = getUser();
    if (!user) {
        window.location.href = 'http://localhost:3000/login.html';
        return;
    }
    try {
        await apiRequest(`/api/jobs/${jobId}/apply`, { method: 'POST' });
        alert('Applied successfully!');
    } catch (error) {
        alert(error.message);
    }
}

// Post job form (employers only; redirect others like admin to dashboard)
if (document.getElementById('postJobForm')) {
    const user = checkAuth();
    if (!user || user.role !== 'employer') {
        window.location.href = 'http://localhost:3000/dashboard.html';
    } else {
        document.getElementById('postJobForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('title').value;
            const company_name = document.getElementById('company_name').value;
            const description = document.getElementById('description').value;
            const requirements = document.getElementById('requirements').value;
            const salary = document.getElementById('salary').value;
            const location = document.getElementById('location').value;
            try {
                await apiRequest('/api/jobs', {
                    method: 'POST',
                    body: JSON.stringify({ title, company_name, description, requirements, salary, location })
                });
                alert('Job posted successfully!');
                window.location.href = 'http://localhost:3000/dashboard.html';
            } catch (error) {
                alert(error.message);
            }
        });
    }
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
