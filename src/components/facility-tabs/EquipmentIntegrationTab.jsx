import React, { useState, useEffect } from 'react';
import { Package, Network, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { facilitiesService } from '../../services/facilitiesService';
import { integrationService } from '../../services/integrationService';
import { templatesService } from '../../services/templatesService';
import { supabase } from '../../lib/supabase';

export default function EquipmentIntegrationTab({ facility, isEditor, onUpdate }) {
  const [equipment, setEquipment] = useState([]);
  const [integration, setIntegration] = useState(null);
  const [interfaces, setInterfaces] = useState([]);
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadData();
  }, [facility?.id]);

  async function loadData() {
    try {
      setLoading(true);

      const equipmentData = facility?.equipment || [];
      setEquipment(equipmentData);

      const integData = await integrationService.getByFacilityId(facility.id);
      setIntegration(integData || {});

      if (integData?.id) {
        const interfaceData = await integrationService.getInterfaceStatus(integData.id);
        setInterfaces(interfaceData || []);
      }

      if (facility.deployment_template_id) {
        const templateData = await templatesService.getDeploymentTemplate(facility.deployment_template_id);
        setTemplate(templateData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function syncFromTemplate() {
    if (!facility.deployment_template_id || !template) return;

    try {
      setSyncing(true);

      const existingTypes = new Set(equipment.map(e => e.equipment_type));
      const newEquipment = [];

      if (template.template_equipment) {
        for (const te of template.template_equipment) {
          if (!existingTypes.has(te.equipment?.equipment_type)) {
            newEquipment.push({
              facility_id: facility.id,
              name: te.equipment?.equipment_name || 'Equipment',
              equipment_type: te.equipment?.equipment_type,
              required: te.is_required,
              procurement_method: te.equipment?.procurement_method_default || 'purchase',
              status: 'Not Ordered',
              equipment_status: 'not_ordered',
              from_template: true,
              template_equipment_id: te.id
            });
          }
        }
      }

      if (newEquipment.length > 0) {
        const { error } = await supabase.from('equipment').insert(newEquipment);
        if (error) throw error;
        await loadData();
        if (onUpdate) onUpdate();
      }
    } catch (error) {
      console.error('Error syncing from template:', error);
      alert('Failed to sync from template');
    } finally {
      setSyncing(false);
    }
  }

  async function handleEquipmentUpdate(equipmentId, updates) {
    try {
      await facilitiesService.updateEquipment(equipmentId, updates);
      await loadData();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating equipment:', error);
    }
  }

  async function handleIntegrationUpdate(updates) {
    try {
      await integrationService.upsert(facility.id, updates);
      setIntegration({ ...integration, ...updates });
    } catch (error) {
      console.error('Error updating integration:', error);
    }
  }

  if (loading) {
    return <div className="text-slate-400">Loading equipment and integration...</div>;
  }

  const lisSetupFee = facility.site_configuration === 'moderate' ? 5062.50 : 2612.50;
  const templateEquipmentIds = new Set(
    template?.template_equipment?.map(te => te.equipment?.equipment_type) || []
  );

  const templateLinkedEquipment = equipment.filter(eq => eq.from_template === true);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Package className="w-5 h-5" />
          Equipment & Integration
        </h3>
        <div className="flex items-center gap-2">
          {template && facility.deployment_template_id && (
            <button
              onClick={syncFromTemplate}
              disabled={syncing}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded text-sm transition-colors"
              title="Sync new equipment from template"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync from Template
            </button>
          )}
          {isEditor && (
            <button
              onClick={() => setEditMode(!editMode)}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm transition-colors"
            >
              {editMode ? 'Done' : 'Edit'}
            </button>
          )}
        </div>
      </div>

      {template && (
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-blue-300 text-sm">
            <Package className="w-4 h-4" />
            <span>Using template: <strong>{template.template_name}</strong></span>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-lg p-4 space-y-3">
        <h4 className="text-white font-semibold text-sm flex items-center gap-2">
          <Package className="w-4 h-4 text-teal-400" />
          Equipment from Template
        </h4>
        {templateLinkedEquipment.length === 0 ? (
          <div className="text-center py-6 text-slate-400">
            <p className="mb-2">No template equipment added yet</p>
            {template && (
              <button
                onClick={syncFromTemplate}
                disabled={syncing}
                className="text-teal-400 hover:text-teal-300 text-sm"
              >
                Sync from template
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {templateLinkedEquipment.map(eq => (
              <div key={eq.id} className="bg-slate-700/50 p-3 rounded-lg">
                <div className="grid grid-cols-6 gap-3 items-center">
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium text-sm">{eq.name}</p>
                      {eq.from_template && (
                        <span className="text-xs bg-blue-600/20 text-blue-300 px-2 py-0.5 rounded">
                          Template
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-xs capitalize">{eq.equipment_type}</p>
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs mb-0.5 block">Status</label>
                    <select
                      value={eq.equipment_status || 'not_ordered'}
                      onChange={(e) => handleEquipmentUpdate(eq.id, { equipment_status: e.target.value })}
                      disabled={!editMode}
                      className="w-full bg-slate-600 text-white px-2 py-1 rounded text-xs border border-slate-500 disabled:opacity-50"
                    >
                      <option value="not_ordered">Not Ordered</option>
                      <option value="ordered">Ordered</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="installed">Installed</option>
                      <option value="validated">Validated</option>
                      <option value="operational">Operational</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs mb-0.5 block">Procurement</label>
                    <select
                      value={eq.procurement_method || 'purchase'}
                      onChange={(e) => handleEquipmentUpdate(eq.id, { procurement_method: e.target.value })}
                      disabled={!editMode}
                      className="w-full bg-slate-600 text-white px-2 py-1 rounded text-xs border border-slate-500 disabled:opacity-50"
                    >
                      <option value="purchase">Purchase</option>
                      <option value="lease">Lease</option>
                      <option value="rental">Rental</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs mb-0.5 block">Serial #</label>
                    <input
                      type="text"
                      value={eq.serial_number || ''}
                      onChange={(e) => handleEquipmentUpdate(eq.id, { serial_number: e.target.value })}
                      disabled={!editMode}
                      placeholder="-"
                      className="w-full bg-slate-600 text-white px-2 py-1 rounded text-xs border border-slate-500 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 text-xs mb-0.5 block">Required</label>
                    <div className="flex items-center gap-1.5 mt-1">
                      {eq.required ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-slate-500" />
                      )}
                      <span className="text-white text-xs">{eq.required ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 space-y-3">
          <h4 className="text-white font-semibold text-sm flex items-center gap-2">
            <Network className="w-4 h-4 text-teal-400" />
            LIS Setup (StratusDX)
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">LIS Provider</label>
              <div className="text-white font-semibold text-sm">StratusDX</div>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">LIS Package</label>
              <select
                value={integration?.lis_package || facility.site_configuration}
                onChange={(e) => handleIntegrationUpdate({ lis_package: e.target.value })}
                disabled={!editMode}
                className="w-full bg-slate-700 text-white px-2 py-1.5 rounded text-sm border border-slate-600 disabled:opacity-50"
              >
                <option value="waived">Waived</option>
                <option value="moderate">Moderate</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Contract Signed</label>
              {editMode ? (
                <input
                  type="checkbox"
                  checked={integration?.lis_contract_signed || false}
                  onChange={(e) => handleIntegrationUpdate({ lis_contract_signed: e.target.checked })}
                  className="w-4 h-4 mt-1"
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  {integration?.lis_contract_signed ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-500" />
                  )}
                  <span className="text-white text-sm">{integration?.lis_contract_signed ? 'Yes' : 'No'}</span>
                </div>
              )}
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Setup Fee</label>
              <div className="text-white font-semibold text-sm">${lisSetupFee.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 space-y-3">
          <h4 className="text-white font-semibold text-sm">Network Configuration</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Network Type</label>
              <select
                value={integration?.network_type || ''}
                onChange={(e) => handleIntegrationUpdate({ network_type: e.target.value })}
                disabled={!editMode}
                className="w-full bg-slate-700 text-white px-2 py-1.5 rounded text-sm border border-slate-600 disabled:opacity-50"
              >
                <option value="">Select Type</option>
                <option value="wired">Wired</option>
                <option value="wireless">Wireless</option>
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Network Verified</label>
              {editMode ? (
                <input
                  type="checkbox"
                  checked={integration?.network_connectivity_verified || false}
                  onChange={(e) => handleIntegrationUpdate({ network_connectivity_verified: e.target.checked })}
                  className="w-4 h-4 mt-1"
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  {integration?.network_connectivity_verified ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-500" />
                  )}
                  <span className="text-white text-sm">{integration?.network_connectivity_verified ? 'Yes' : 'No'}</span>
                </div>
              )}
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Verification Date</label>
              <input
                type="date"
                value={integration?.network_verification_date || ''}
                onChange={(e) => handleIntegrationUpdate({ network_verification_date: e.target.value })}
                disabled={!editMode}
                className="w-full bg-slate-700 text-white px-2 py-1.5 rounded text-sm border border-slate-600 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">HIPAA Compliant</label>
              {editMode ? (
                <input
                  type="checkbox"
                  checked={integration?.hipaa_compliant_network || false}
                  onChange={(e) => handleIntegrationUpdate({ hipaa_compliant_network: e.target.checked })}
                  className="w-4 h-4 mt-1"
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  {integration?.hipaa_compliant_network ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-500" />
                  )}
                  <span className="text-white text-sm">{integration?.hipaa_compliant_network ? 'Yes' : 'No'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 space-y-3">
          <h4 className="text-white font-semibold text-sm">Auto Label Print</h4>
          <div className="flex items-center gap-3">
            {editMode ? (
              <input
                type="checkbox"
                checked={integration?.auto_label_print_configured || false}
                onChange={(e) => handleIntegrationUpdate({ auto_label_print_configured: e.target.checked })}
                className="w-4 h-4"
              />
            ) : (
              <div className="flex items-center gap-1.5">
                {integration?.auto_label_print_configured ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-500" />
                )}
              </div>
            )}
            <span className="text-slate-300 text-sm">{integration?.auto_label_print_configured ? 'Configured' : 'Not Configured'}</span>
          </div>
        </div>

        <div className="bg-slate-800 rounded-lg p-4 space-y-3">
          <h4 className="text-white font-semibold text-sm">EHR Integration</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Integration Required</label>
              {editMode ? (
                <input
                  type="checkbox"
                  checked={integration?.ehr_integration_required || false}
                  onChange={(e) => handleIntegrationUpdate({ ehr_integration_required: e.target.checked })}
                  className="w-4 h-4 mt-1"
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  {integration?.ehr_integration_required ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-slate-500" />
                  )}
                  <span className="text-white text-sm">{integration?.ehr_integration_required ? 'Yes' : 'No'}</span>
                </div>
              )}
            </div>
            {integration?.ehr_integration_required && (
              <>
                <div>
                  <label className="text-slate-400 text-xs mb-1 block">EHR Vendor</label>
                  <input
                    type="text"
                    value={integration?.ehr_vendor || ''}
                    onChange={(e) => handleIntegrationUpdate({ ehr_vendor: e.target.value })}
                    disabled={!editMode}
                    className="w-full bg-slate-700 text-white px-2 py-1.5 rounded text-sm border border-slate-600 disabled:opacity-50"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-slate-400 text-xs mb-1 block">Integration Complete</label>
                  {editMode ? (
                    <input
                      type="checkbox"
                      checked={integration?.ehr_integration_complete || false}
                      onChange={(e) => handleIntegrationUpdate({ ehr_integration_complete: e.target.checked })}
                      className="w-4 h-4 mt-1"
                    />
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {integration?.ehr_integration_complete ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-slate-500" />
                      )}
                      <span className="text-white text-sm">{integration?.ehr_integration_complete ? 'Yes' : 'No'}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 space-y-3">
        <h4 className="text-white font-semibold text-sm">Instrument Interfaces</h4>
        <div className="grid grid-cols-4 gap-3">
          {['genexpert', 'clarity', 'epoc', 'abacus'].map(inst => {
            const interfaceData = interfaces.find(i => i.instrument_type === inst) || {
              instrument_type: inst,
              interface_type: 'bidirectional',
              configured: false,
              tested_successfully: false,
            };

            return (
              <div key={inst} className="bg-slate-700 p-3 rounded">
                <p className="text-slate-300 font-semibold mb-2 capitalize text-sm">{inst}</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={interfaceData.configured || false}
                      disabled={!isEditor}
                      className="w-3.5 h-3.5"
                    />
                    <label className="text-slate-400">Configured</label>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={interfaceData.tested_successfully || false}
                      disabled={!isEditor}
                      className="w-3.5 h-3.5"
                    />
                    <label className="text-slate-400">Tested</label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
