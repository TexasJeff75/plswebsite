import { supabase } from './supabase.js';

let currentFilter = 'all';
let allDeployments = [];

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
  },
  rolled_back: {
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/30',
    label: 'Rolled Back'
  }
};

const environmentConfig = {
  development: {
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    label: 'Development'
  },
  staging: {
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    label: 'Staging'
  },
  production: {
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    label: 'Production'
  }
};

async function fetchDeployments() {
  try {
    const { data, error } = await supabase
      .from('deployments')
      .select('*')
      .order('deployment_date', { ascending: false });

    if (error) throw error;

    allDeployments = data || [];
    renderDeployments();
    updateStats();
  } catch (error) {
    console.error('Error fetching deployments:', error);
    showError('Failed to load deployments. Please refresh the page.');
  }
}

function renderDeployments() {
  const container = document.getElementById('deploymentsContainer');

  const filteredDeployments = currentFilter === 'all'
    ? allDeployments
    : allDeployments.filter(d => d.status === currentFilter);

  if (filteredDeployments.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16">
        <div class="mb-6 flex justify-center">
          <div class="w-20 h-20 rounded-full bg-champagne/10 flex items-center justify-center">
            <svg class="w-10 h-10 text-champagne/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
            </svg>
          </div>
        </div>
        <p class="text-platinum text-lg font-semibold mb-2">No deployments found</p>
        <p class="text-platinum/60">Add your first deployment to get started</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredDeployments.map((deployment, index) => {
    const status = statusConfig[deployment.status] || statusConfig.pending;
    const env = environmentConfig[deployment.environment] || environmentConfig.development;
    const date = new Date(deployment.deployment_date);
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const statusIcons = {
      pending: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
      in_progress: '<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
      completed: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
      failed: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
      rolled_back: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z"/></svg>'
    };

    return `
      <div class="deployment-card glass-luxury p-6 rounded-xl border transition-all duration-300 transform hover:scale-102 hover:shadow-2xl overflow-hidden relative group"
           style="animation: slideIn 0.4s ease-out ${index * 50}ms backwards; border-color: ${status.color === 'text-green-400' ? 'rgba(74, 222, 128, 0.2)' : status.color === 'text-red-400' ? 'rgba(248, 113, 113, 0.2)' : status.color === 'text-bright-blue' ? 'rgba(96, 165, 250, 0.2)' : 'rgba(230, 204, 97, 0.2)'};">
        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-platinum/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
        <div class="relative z-10">
          <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-start gap-3 mb-4 flex-wrap">
                <div class="flex items-center gap-2 pt-1">
                  <div class="w-8 h-8 rounded-lg ${status.bg} flex items-center justify-center ${status.color}">
                    ${statusIcons[deployment.status] || statusIcons.pending}
                  </div>
                </div>
                <div>
                  <h3 class="text-xl font-semibold text-platinum">${escapeHtml(deployment.project_name)}</h3>
                  <div class="flex items-center gap-2 mt-2 flex-wrap">
                    <span class="px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color} border ${status.border} backdrop-blur-sm">
                      ${status.label}
                    </span>
                    <span class="px-3 py-1 rounded-full text-xs font-medium ${env.bg} ${env.color} backdrop-blur-sm">
                      ${env.label}
                    </span>
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                <div class="flex items-center gap-2 text-platinum/70">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                  </svg>
                  <span class="truncate">${escapeHtml(deployment.version)}</span>
                </div>
                <div class="flex items-center gap-2 text-platinum/70">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  <span class="truncate">${escapeHtml(deployment.deployed_by)}</span>
                </div>
                <div class="flex items-center gap-2 text-platinum/70 col-span-2 md:col-span-2">
                  <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span class="text-xs">${formattedDate}</span>
                </div>
              </div>
              ${deployment.notes ? `
                <p class="text-platinum/70 text-sm bg-platinum/5 rounded-lg px-3 py-2 mt-3 line-clamp-2">${escapeHtml(deployment.notes)}</p>
              ` : ''}
            </div>
            <div class="flex gap-2 flex-shrink-0">
              <button onclick="editDeployment('${deployment.id}')" class="glass-luxury px-4 py-2 rounded-lg text-sm font-medium text-champagne hover:bg-champagne/10 hover:border-champagne/50 transition-all duration-300 transform hover:scale-110">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button onclick="deleteDeployment('${deployment.id}')" class="glass-luxury px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-400/10 hover:border-red-400/50 transition-all duration-300 transform hover:scale-110">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Add animation styles
  if (!document.getElementById('deploymentAnimationStyles')) {
    const style = document.createElement('style');
    style.id = 'deploymentAnimationStyles';
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
      .deployment-card {
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .deployment-card:hover {
        transform: scale(1.02);
      }
    `;
    document.head.appendChild(style);
  }
}

function updateStats() {
  const total = allDeployments.length;
  const completed = allDeployments.filter(d => d.status === 'completed').length;
  const inProgress = allDeployments.filter(d => d.status === 'in_progress').length;
  const failed = allDeployments.filter(d => d.status === 'failed').length;

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

      renderDeployments();
    });
  });
}

function setupAddDeploymentButton() {
  const addBtn = document.getElementById('addDeploymentBtn');
  const modal = document.getElementById('deploymentModal');
  const form = document.getElementById('deploymentForm');

  addBtn.addEventListener('click', () => {
    form.reset();

    // Reset modal to "Add" mode
    const titleContainer = modal.querySelector('.flex.items-center.gap-3');
    const icon = titleContainer.querySelector('div');
    icon.innerHTML = '<svg class="w-6 h-6 text-champagne" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m0 0h6"/></svg>';
    titleContainer.querySelector('h2').textContent = 'Add New Deployment';

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
    const deployment = {
      project_name: formData.get('projectName'),
      version: formData.get('version'),
      environment: formData.get('environment'),
      status: formData.get('status'),
      deployed_by: formData.get('deployedBy'),
      notes: formData.get('notes') || null
    };

    try {
      const { data, error } = await supabase
        .from('deployments')
        .insert([deployment])
        .select();

      if (error) throw error;

      modal.style.opacity = '0';
      setTimeout(() => {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        form.reset();
      }, 300);

      await fetchDeployments();
      showSuccess('Deployment added successfully!');
    } catch (error) {
      console.error('Error adding deployment:', error);
      showError('Failed to add deployment. Please try again.');
    }
  });
}

window.deleteDeployment = async function(id) {
  if (!confirm('Are you sure you want to delete this deployment?')) {
    return;
  }

  try {
    const { error } = await supabase
      .from('deployments')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await fetchDeployments();
    showSuccess('Deployment deleted successfully!');
  } catch (error) {
    console.error('Error deleting deployment:', error);
    showError('Failed to delete deployment. Please try again.');
  }
};

window.editDeployment = async function(id) {
  const deployment = allDeployments.find(d => d.id === id);
  if (!deployment) return;

  const modal = document.getElementById('deploymentModal');
  const form = document.getElementById('deploymentForm');
  const title = modal.querySelector('h2');

  document.getElementById('projectName').value = deployment.project_name;
  document.getElementById('version').value = deployment.version;
  document.getElementById('environment').value = deployment.environment;
  document.getElementById('status').value = deployment.status;
  document.getElementById('deployedBy').value = deployment.deployed_by;
  document.getElementById('notes').value = deployment.notes || '';

  // Update modal title for edit mode
  const titleContainer = modal.querySelector('.flex.items-center.gap-3');
  const icon = titleContainer.querySelector('div');
  icon.innerHTML = '<svg class="w-6 h-6 text-champagne" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>';
  titleContainer.querySelector('h2').textContent = 'Edit Deployment';

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
      project_name: formData.get('projectName'),
      version: formData.get('version'),
      environment: formData.get('environment'),
      status: formData.get('status'),
      deployed_by: formData.get('deployedBy'),
      notes: formData.get('notes') || null,
      updated_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('deployments')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      modal.style.opacity = '0';
      setTimeout(() => {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
        form.reset();
      }, 300);

      form.onsubmit = setupAddDeploymentButton;

      await fetchDeployments();
      showSuccess('Deployment updated successfully!');
    } catch (error) {
      console.error('Error updating deployment:', error);
      showError('Failed to update deployment. Please try again.');
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
  setupAddDeploymentButton();
  fetchDeployments();
});
