import { supabase } from './supabase.js';

let currentFilter = 'all';
let allFacilities = [];
let allOrganizations = [];
let allProjects = [];

const statusConfig = {
  pending: {
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/30',
    label: 'Pending'
  },
  in_progress: {
    color: 'text-bright-blue',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/30',
    label: 'In Progress'
  },
  completed: {
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    border: 'border-green-400/30',
    label: 'Completed'
  },
  failed: {
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    border: 'border-red-400/30',
    label: 'Failed'
  }
};

async function fetchAllData() {
  try {
    const [orgsResult, projectsResult, facilitiesResult] = await Promise.all([
      supabase.from('deployment_organizations').select('*').order('name'),
      supabase.from('deployment_projects').select('*').order('name'),
      supabase.from('deployment_facilities').select('*').order('created_at', { ascending: false })
    ]);

    if (orgsResult.error) throw orgsResult.error;
    if (projectsResult.error) throw projectsResult.error;
    if (facilitiesResult.error) throw facilitiesResult.error;

    allOrganizations = orgsResult.data || [];
    allProjects = projectsResult.data || [];
    allFacilities = facilitiesResult.data || [];

    populateOrganizationDropdown();
    renderFacilities();
    updateStats();
  } catch (error) {
    console.error('Error fetching data:', error);
    showError('Failed to load data. Please refresh the page.');
  }
}

function populateOrganizationDropdown() {
  const dropdown = document.getElementById('organizationId');
  dropdown.innerHTML = '<option value="">Select Organization</option>';

  allOrganizations.forEach(org => {
    const option = document.createElement('option');
    option.value = org.id;
    option.textContent = org.abbreviation ? `${org.name} (${org.abbreviation})` : org.name;
    dropdown.appendChild(option);
  });
}

function populateProjectDropdown(organizationId) {
  const dropdown = document.getElementById('projectId');
  dropdown.innerHTML = '<option value="">Select Project</option>';

  if (!organizationId) return;

  const projects = allProjects.filter(p => p.organization_id === organizationId);
  projects.forEach(project => {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.name;
    dropdown.appendChild(option);
  });
}

function renderFacilities() {
  const container = document.getElementById('facilitiesContainer');

  const filteredFacilities = currentFilter === 'all'
    ? allFacilities
    : allFacilities.filter(f => f.status === currentFilter);

  if (filteredFacilities.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16">
        <div class="mb-6 flex justify-center">
          <div class="w-20 h-20 rounded-full bg-champagne/10 flex items-center justify-center">
            <svg class="w-10 h-10 text-champagne/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
            </svg>
          </div>
        </div>
        <p class="text-platinum text-lg font-semibold mb-2">No facilities found</p>
        <p class="text-platinum/60">Add your first facility to get started</p>
      </div>
    `;
    return;
  }

  const groupedFacilities = {};

  filteredFacilities.forEach(facility => {
    const project = allProjects.find(p => p.id === facility.project_id);
    const org = project ? allOrganizations.find(o => o.id === project.organization_id) : null;

    if (!org || !project) return;

    const orgKey = org.id;
    const projectKey = project.id;

    if (!groupedFacilities[orgKey]) {
      groupedFacilities[orgKey] = {
        org,
        projects: {}
      };
    }

    if (!groupedFacilities[orgKey].projects[projectKey]) {
      groupedFacilities[orgKey].projects[projectKey] = {
        project,
        facilities: []
      };
    }

    groupedFacilities[orgKey].projects[projectKey].facilities.push(facility);
  });

  let html = '';
  let cardIndex = 0;

  Object.values(groupedFacilities).forEach(({ org, projects }) => {
    html += `
      <div class="glass-luxury rounded-xl p-6 mb-6 border border-champagne/20">
        <h3 class="text-2xl font-bold text-champagne mb-4 flex items-center gap-3">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
          </svg>
          ${escapeHtml(org.abbreviation ? `${org.name} (${org.abbreviation})` : org.name)}
        </h3>
    `;

    Object.values(projects).forEach(({ project, facilities }) => {
      const projectStatus = statusConfig[project.status] || statusConfig.pending;

      html += `
        <div class="ml-8 mb-6">
          <div class="flex items-center gap-3 mb-4">
            <svg class="w-5 h-5 text-bright-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
            </svg>
            <h4 class="text-xl font-semibold text-platinum">${escapeHtml(project.name)}</h4>
            <span class="px-3 py-1 rounded-full text-xs font-medium ${projectStatus.bg} ${projectStatus.color} border ${projectStatus.border}">
              ${projectStatus.label}
            </span>
          </div>
          <div class="ml-8 space-y-4">
      `;

      facilities.forEach(facility => {
        const status = statusConfig[facility.status] || statusConfig.pending;
        const date = facility.deployment_date ? new Date(facility.deployment_date) : null;
        const formattedDate = date ? date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 'Not deployed';

        const statusIcons = {
          pending: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
          in_progress: '<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
          completed: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
          failed: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
        };

        html += `
          <div class="facility-card glass-luxury p-5 rounded-lg border transition-all duration-300 transform hover:scale-102 hover:shadow-xl overflow-hidden relative group"
               style="animation: slideIn 0.4s ease-out ${cardIndex * 50}ms backwards; border-color: ${status.color === 'text-green-400' ? 'rgba(74, 222, 128, 0.2)' : status.color === 'text-red-400' ? 'rgba(248, 113, 113, 0.2)' : status.color === 'text-bright-blue' ? 'rgba(96, 165, 250, 0.2)' : 'rgba(230, 204, 97, 0.2)'};">
            <div class="absolute inset-0 bg-gradient-to-r from-transparent via-platinum/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div class="relative z-10">
              <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div class="flex-1">
                  <div class="flex items-start gap-3 mb-3">
                    <div class="w-8 h-8 rounded-lg ${status.bg} flex items-center justify-center ${status.color}">
                      ${statusIcons[facility.status] || statusIcons.pending}
                    </div>
                    <div class="flex-1">
                      <h5 class="text-lg font-semibold text-platinum">${escapeHtml(facility.name)}</h5>
                      <span class="px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color} border ${status.border} inline-block mt-2">
                        ${status.label}
                      </span>
                    </div>
                  </div>
                  <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm ml-11">
                    ${facility.location ? `
                      <div class="flex items-center gap-2 text-platinum/70 col-span-2">
                        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        <span class="truncate">${escapeHtml(facility.location)}</span>
                      </div>
                    ` : ''}
                    ${facility.deployed_by ? `
                      <div class="flex items-center gap-2 text-platinum/70">
                        <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                        <span class="truncate">${escapeHtml(facility.deployed_by)}</span>
                      </div>
                    ` : ''}
                    <div class="flex items-center gap-2 text-platinum/70">
                      <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                      </svg>
                      <span class="text-xs">${formattedDate}</span>
                    </div>
                  </div>
                  ${facility.notes ? `
                    <p class="text-platinum/70 text-sm bg-platinum/5 rounded-lg px-3 py-2 mt-3 ml-11 line-clamp-2">${escapeHtml(facility.notes)}</p>
                  ` : ''}
                </div>
                <div class="flex gap-2 flex-shrink-0">
                  <button onclick="editFacility('${facility.id}')" class="glass-luxury px-3 py-2 rounded-lg text-sm font-medium text-champagne hover:bg-champagne/10 hover:border-champagne/50 transition-all duration-300 transform hover:scale-110">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                  </button>
                  <button onclick="deleteFacility('${facility.id}')" class="glass-luxury px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-400/10 hover:border-red-400/50 transition-all duration-300 transform hover:scale-110">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
        cardIndex++;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += `</div>`;
  });

  container.innerHTML = html;

  if (!document.getElementById('facilityAnimationStyles')) {
    const style = document.createElement('style');
    style.id = 'facilityAnimationStyles';
    style.textContent = `
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .facility-card {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .facility-card:hover {
        transform: scale(1.02);
      }
    `;
    document.head.appendChild(style);
  }
}

function updateStats() {
  const total = allFacilities.length;
  const completed = allFacilities.filter(f => f.status === 'completed').length;
  const inProgress = allFacilities.filter(f => f.status === 'in_progress').length;
  const failed = allFacilities.filter(f => f.status === 'failed').length;

  animateCounterTo('totalCount', total);
  animateCounterTo('completedCount', completed);
  animateCounterTo('inProgressCount', inProgress);
  animateCounterTo('failedCount', failed);
}

function animateCounterTo(elementId, targetValue) {
  const element = document.getElementById(elementId);
  const currentValue = parseInt(element.textContent) || 0;

  if (currentValue === targetValue) return;

  const duration = 600;
  const increment = (targetValue - currentValue) / (duration / 30);
  let currentCount = currentValue;

  const timer = setInterval(() => {
    currentCount += increment;
    if ((increment > 0 && currentCount >= targetValue) || (increment < 0 && currentCount <= targetValue)) {
      element.textContent = targetValue;
      element.classList.add('stat-updated');
      clearInterval(timer);
      setTimeout(() => element.classList.remove('stat-updated'), 400);
    } else {
      element.textContent = Math.floor(currentCount);
    }
  }, 30);
}

function setupFilterButtons() {
  const filterButtons = {
    'filterAll': 'all',
    'filterPending': 'pending',
    'filterInProgress': 'in_progress',
    'filterCompleted': 'completed',
    'filterFailed': 'failed'
  };

  Object.entries(filterButtons).forEach(([buttonId, filterValue]) => {
    const button = document.getElementById(buttonId);
    button.addEventListener('click', () => {
      currentFilter = filterValue;

      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-champagne', 'text-midnight', 'shadow-lg');
        btn.classList.add('glass-luxury', 'text-platinum/70');
      });

      button.classList.add('active', 'bg-champagne', 'text-midnight', 'shadow-lg');
      button.classList.remove('glass-luxury', 'text-platinum/70');

      button.style.animation = 'none';
      setTimeout(() => {
        button.style.animation = 'pulse 0.3s ease-out';
      }, 10);

      renderFacilities();
    });
  });
}

function setupAddFacilityButton() {
  const addBtn = document.getElementById('addFacilityBtn');
  const modal = document.getElementById('facilityModal');
  const form = document.getElementById('facilityForm');
  const orgDropdown = document.getElementById('organizationId');

  orgDropdown.addEventListener('change', (e) => {
    populateProjectDropdown(e.target.value);
  });

  addBtn.addEventListener('click', () => {
    form.reset();
    populateProjectDropdown(null);

    const titleContainer = modal.querySelector('.flex.items-center.gap-3');
    const icon = titleContainer.querySelector('div');
    icon.innerHTML = '<svg class="w-6 h-6 text-champagne" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>';
    titleContainer.querySelector('h2').textContent = 'Add New Facility';

    modal.classList.remove('hidden');
    modal.style.opacity = '0';
    document.body.style.overflow = 'hidden';

    setTimeout(() => {
      modal.style.transition = 'opacity 0.3s ease-out';
      modal.style.opacity = '1';
    }, 10);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const facility = {
      project_id: formData.get('projectId'),
      name: formData.get('facilityName'),
      location: formData.get('location') || null,
      status: formData.get('status'),
      deployed_by: formData.get('deployedBy') || null,
      notes: formData.get('notes') || null,
      deployment_date: formData.get('status') === 'completed' ? new Date().toISOString() : null
    };

    try {
      const { data, error } = await supabase
        .from('deployment_facilities')
        .insert([facility])
        .select();

      if (error) throw error;

      modal.style.opacity = '0';
      setTimeout(() => {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        form.reset();
      }, 300);

      await fetchAllData();
      showSuccess('Facility added successfully!');
    } catch (error) {
      console.error('Error adding facility:', error);
      showError('Failed to add facility. Please try again.');
    }
  });
}

window.deleteFacility = async function(id) {
  if (!confirm('Are you sure you want to delete this facility?')) {
    return;
  }

  try {
    const { error } = await supabase
      .from('deployment_facilities')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await fetchAllData();
    showSuccess('Facility deleted successfully!');
  } catch (error) {
    console.error('Error deleting facility:', error);
    showError('Failed to delete facility. Please try again.');
  }
};

window.editFacility = async function(id) {
  const facility = allFacilities.find(f => f.id === id);
  if (!facility) return;

  const project = allProjects.find(p => p.id === facility.project_id);
  if (!project) return;

  const modal = document.getElementById('facilityModal');
  const form = document.getElementById('facilityForm');

  document.getElementById('organizationId').value = project.organization_id;
  populateProjectDropdown(project.organization_id);

  setTimeout(() => {
    document.getElementById('projectId').value = facility.project_id;
  }, 50);

  document.getElementById('facilityName').value = facility.name;
  document.getElementById('location').value = facility.location || '';
  document.getElementById('status').value = facility.status;
  document.getElementById('deployedBy').value = facility.deployed_by || '';
  document.getElementById('notes').value = facility.notes || '';

  const titleContainer = modal.querySelector('.flex.items-center.gap-3');
  const icon = titleContainer.querySelector('div');
  icon.innerHTML = '<svg class="w-6 h-6 text-champagne" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>';
  titleContainer.querySelector('h2').textContent = 'Edit Facility';

  modal.classList.remove('hidden');
  modal.style.opacity = '0';
  document.body.style.overflow = 'hidden';

  setTimeout(() => {
    modal.style.transition = 'opacity 0.3s ease-out';
    modal.style.opacity = '1';
  }, 10);

  form.onsubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const updates = {
      project_id: formData.get('projectId'),
      name: formData.get('facilityName'),
      location: formData.get('location') || null,
      status: formData.get('status'),
      deployed_by: formData.get('deployedBy') || null,
      notes: formData.get('notes') || null,
      deployment_date: formData.get('status') === 'completed' && !facility.deployment_date ? new Date().toISOString() : facility.deployment_date,
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('deployment_facilities')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      modal.style.opacity = '0';
      setTimeout(() => {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        form.reset();
      }, 300);

      form.onsubmit = setupAddFacilityButton;

      await fetchAllData();
      showSuccess('Facility updated successfully!');
    } catch (error) {
      console.error('Error updating facility:', error);
      showError('Failed to update facility. Please try again.');
    }
  };
};

function showSuccess(message) {
  showNotification(message, 'success');
}

function showError(message) {
  showNotification(message, 'error');
}

function showNotification(message, type) {
  const notification = document.createElement('div');

  if (type === 'success') {
    notification.className = 'fixed top-6 right-6 glass-luxury border-2 border-champagne text-platinum px-6 py-4 rounded-lg shadow-2xl z-50 transform transition-all duration-300 opacity-0 translate-y-2';
    notification.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="flex-shrink-0">
          <svg class="w-5 h-5 text-champagne animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
  } else {
    notification.className = 'fixed top-6 right-6 glass-luxury border-2 border-red-400 text-platinum px-6 py-4 rounded-lg shadow-2xl z-50 transform transition-all duration-300 opacity-0 translate-y-2';
    notification.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="flex-shrink-0">
          <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        </div>
        <span>${escapeHtml(message)}</span>
      </div>
    `;
  }

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
  }, 10);

  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(10px)';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3500);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  setupFilterButtons();
  setupAddFacilityButton();
  fetchAllData();
});
