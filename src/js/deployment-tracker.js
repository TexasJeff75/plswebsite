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
      <div class="text-center py-12">
        <svg class="w-16 h-16 mx-auto text-platinum/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
        </svg>
        <p class="text-platinum/50 text-lg">No deployments found</p>
        <p class="text-platinum/30 mt-2">Add your first deployment to get started</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredDeployments.map(deployment => {
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

    return `
      <div class="glass-luxury champagne-glow p-6 rounded-xl border border-platinum/10 hover:border-champagne/30 transition-all">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <h3 class="text-xl font-semibold text-platinum">${escapeHtml(deployment.project_name)}</h3>
              <span class="px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color} border ${status.border}">
                ${status.label}
              </span>
              <span class="px-3 py-1 rounded-full text-xs font-medium ${env.bg} ${env.color}">
                ${env.label}
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-4 text-sm text-platinum/60 mb-2">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                </svg>
                <span>${escapeHtml(deployment.version)}</span>
              </div>
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                <span>${escapeHtml(deployment.deployed_by)}</span>
              </div>
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>${formattedDate}</span>
              </div>
            </div>
            ${deployment.notes ? `
              <p class="text-platinum/70 text-sm mt-2 line-clamp-2">${escapeHtml(deployment.notes)}</p>
            ` : ''}
          </div>
          <div class="flex gap-2">
            <button onclick="editDeployment('${deployment.id}')" class="glass-luxury px-4 py-2 rounded-lg text-sm font-medium text-champagne hover:bg-champagne/10 transition-colors">
              Edit
            </button>
            <button onclick="deleteDeployment('${deployment.id}')" class="glass-luxury px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-400/10 transition-colors">
              Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateStats() {
  const total = allDeployments.length;
  const completed = allDeployments.filter(d => d.status === 'completed').length;
  const inProgress = allDeployments.filter(d => d.status === 'in_progress').length;
  const failed = allDeployments.filter(d => d.status === 'failed').length;

  document.getElementById('totalCount').textContent = total;
  document.getElementById('completedCount').textContent = completed;
  document.getElementById('inProgressCount').textContent = inProgress;
  document.getElementById('failedCount').textContent = failed;
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
        btn.classList.remove('active');
        btn.classList.remove('bg-champagne', 'text-midnight');
        btn.classList.add('glass-luxury', 'text-platinum/70');
      });

      button.classList.add('active');
      button.classList.remove('glass-luxury', 'text-platinum/70');
      button.classList.add('bg-champagne', 'text-midnight');

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
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
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

      modal.classList.add('hidden');
      document.body.style.overflow = 'auto';
      form.reset();

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

  document.getElementById('projectName').value = deployment.project_name;
  document.getElementById('version').value = deployment.version;
  document.getElementById('environment').value = deployment.environment;
  document.getElementById('status').value = deployment.status;
  document.getElementById('deployedBy').value = deployment.deployed_by;
  document.getElementById('notes').value = deployment.notes || '';

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

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

      modal.classList.add('hidden');
      document.body.style.overflow = 'auto';
      form.reset();

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
  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';

  notification.className = `fixed top-4 right-4 ${bgColor} text-white px-6 py-4 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.remove('translate-x-full');
  }, 100);

  setTimeout(() => {
    notification.classList.add('translate-x-full');
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
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
