import React, { useState, useEffect } from 'react';
import { Network, CheckCircle2 } from 'lucide-react';
import { integrationService } from '../../services/integrationService';

export default function IntegrationTab({ facility, isEditor }) {
  const [integration, setIntegration] = useState(null);
  const [interfaces, setInterfaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    loadIntegrationData();
  }, [facility?.id]);

  async function loadIntegrationData() {
    try {
      setLoading(true);
      const integData = await integrationService.getByFacilityId(facility.id);
      setIntegration(integData || {});
      if (integData?.id) {
        const interfaceData = await integrationService.getInterfaceStatus(integData.id);
        setInterfaces(interfaceData);
      }
    } catch (error) {
      console.error('Error loading integration:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(updates) {
    try {
      await integrationService.upsert(facility.id, updates);
      setIntegration({ ...integration, ...updates });
      setEditMode(false);
    } catch (error) {
      console.error('Error saving integration:', error);
    }
  }

  if (loading) {
    return <div className="text-slate-400">Loading integration information...</div>;
  }

  const lisSetupFee = facility.site_configuration === 'moderate' ? 5062.50 : 2612.50;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Network className="w-5 h-5" />
          System Integration
        </h3>
        {isEditor && (
          <button
            onClick={() => setEditMode(!editMode)}
            className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm transition-colors"
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
        )}
      </div>

      {/* LIS Setup */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">LIS Setup (StratusDX)</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-slate-400 text-sm mb-1 block">LIS Provider</label>
            <div className="text-white font-semibold">StratusDX</div>
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">LIS Package</label>
            <select
              value={integration?.lis_package || facility.site_configuration}
              onChange={(e) => setIntegration({ ...integration, lis_package: e.target.value })}
              disabled={!editMode}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
            >
              <option value="waived">Waived Complexity</option>
              <option value="moderate">Moderate Complexity</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Contract Signed</label>
            {editMode ? (
              <input
                type="checkbox"
                checked={integration?.lis_contract_signed || false}
                onChange={(e) => setIntegration({ ...integration, lis_contract_signed: e.target.checked })}
                className="w-4 h-4"
              />
            ) : (
              <div className="flex items-center gap-2">
                {integration?.lis_contract_signed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-500" />
                )}
              </div>
            )}
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Setup Fee</label>
            <div className="text-white font-semibold">${lisSetupFee.toFixed(2)}</div>
          </div>
        </div>
        {editMode && (
          <button
            onClick={() => handleSave({ lis_contract_signed: integration.lis_contract_signed, lis_package: integration.lis_package })}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium mt-4 transition-colors"
          >
            Save LIS Setup
          </button>
        )}
      </div>

      {/* Interface Status */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Instrument Interfaces</h4>
        <div className="grid grid-cols-2 gap-4">
          {['genexpert', 'clarity', 'epoc', 'abacus'].map(inst => {
            const interfaceData = interfaces.find(i => i.instrument_type === inst) || {
              instrument_type: inst,
              interface_type: 'bidirectional',
              configured: false,
              tested_successfully: false,
            };

            return (
              <div key={inst} className="bg-slate-700 p-4 rounded">
                <p className="text-slate-300 font-semibold mb-3 capitalize">{inst}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <label className="text-slate-400 flex-1">Interface Type</label>
                    <select
                      value={interfaceData.interface_type || ''}
                      disabled={!isEditor}
                      className="bg-slate-600 text-white px-2 py-1 rounded text-xs border border-slate-500 disabled:opacity-50"
                    >
                      <option value="unidirectional">Unidirectional</option>
                      <option value="bidirectional">Bidirectional</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={interfaceData.configured || false}
                      disabled={!isEditor}
                      className="w-4 h-4"
                    />
                    <label className="text-slate-400">Configured</label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={interfaceData.tested_successfully || false}
                      disabled={!isEditor}
                      className="w-4 h-4"
                    />
                    <label className="text-slate-400">Tested Successfully</label>
                  </div>
                  {interfaceData.tested_successfully && (
                    <p className="text-teal-300 text-xs mt-2">
                      Test Date: {interfaceData.test_date || 'Not set'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto Label Print */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Auto Label Print</h4>
        <div className="flex items-center gap-4">
          {editMode ? (
            <input
              type="checkbox"
              checked={integration?.auto_label_print_configured || false}
              onChange={(e) => setIntegration({ ...integration, auto_label_print_configured: e.target.checked })}
              className="w-5 h-5"
            />
          ) : (
            <div className="flex items-center gap-2">
              {integration?.auto_label_print_configured ? (
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-slate-500" />
              )}
            </div>
          )}
          <span className="text-slate-300">{integration?.auto_label_print_configured ? 'Configured' : 'Not Configured'}</span>
        </div>
        {editMode && (
          <button
            onClick={() => handleSave({ auto_label_print_configured: integration.auto_label_print_configured })}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium mt-4 transition-colors"
          >
            Save Auto Label Print
          </button>
        )}
      </div>

      {/* Network Configuration */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Network Configuration</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Network Type</label>
            <select
              value={integration?.network_type || ''}
              onChange={(e) => setIntegration({ ...integration, network_type: e.target.value })}
              disabled={!editMode}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
            >
              <option value="">Select Type</option>
              <option value="wired">Wired</option>
              <option value="wireless">Wireless</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Network Verified</label>
            {editMode ? (
              <input
                type="checkbox"
                checked={integration?.network_connectivity_verified || false}
                onChange={(e) => setIntegration({ ...integration, network_connectivity_verified: e.target.checked })}
                className="w-4 h-4"
              />
            ) : (
              <div className="flex items-center gap-2">
                {integration?.network_connectivity_verified ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-500" />
                )}
              </div>
            )}
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Verification Date</label>
            <input
              type="date"
              value={integration?.network_verification_date || ''}
              onChange={(e) => setIntegration({ ...integration, network_verification_date: e.target.value })}
              disabled={!editMode}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">HIPAA Compliant</label>
            {editMode ? (
              <input
                type="checkbox"
                checked={integration?.hipaa_compliant_network || false}
                onChange={(e) => setIntegration({ ...integration, hipaa_compliant_network: e.target.checked })}
                className="w-4 h-4"
              />
            ) : (
              <div className="flex items-center gap-2">
                {integration?.hipaa_compliant_network ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-500" />
                )}
              </div>
            )}
          </div>
        </div>
        {editMode && (
          <button
            onClick={() => handleSave({ network_type: integration.network_type, network_connectivity_verified: integration.network_connectivity_verified, network_verification_date: integration.network_verification_date, hipaa_compliant_network: integration.hipaa_compliant_network })}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium mt-4 transition-colors"
          >
            Save Network Configuration
          </button>
        )}
      </div>

      {/* EHR Integration */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">EHR Integration</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Integration Required</label>
            {editMode ? (
              <input
                type="checkbox"
                checked={integration?.ehr_integration_required || false}
                onChange={(e) => setIntegration({ ...integration, ehr_integration_required: e.target.checked })}
                className="w-4 h-4"
              />
            ) : (
              <div className="flex items-center gap-2">
                {integration?.ehr_integration_required ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-500" />
                )}
              </div>
            )}
          </div>
          {integration?.ehr_integration_required && (
            <>
              <div>
                <label className="text-slate-400 text-sm mb-1 block">EHR Vendor</label>
                <input
                  type="text"
                  value={integration?.ehr_vendor || ''}
                  onChange={(e) => setIntegration({ ...integration, ehr_vendor: e.target.value })}
                  disabled={!editMode}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Integration Complete</label>
                {editMode ? (
                  <input
                    type="checkbox"
                    checked={integration?.ehr_integration_complete || false}
                    onChange={(e) => setIntegration({ ...integration, ehr_integration_complete: e.target.checked })}
                    className="w-4 h-4"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    {integration?.ehr_integration_complete ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-500" />
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {editMode && (
          <button
            onClick={() => handleSave({ ehr_integration_required: integration.ehr_integration_required, ehr_vendor: integration.ehr_vendor, ehr_integration_complete: integration.ehr_integration_complete })}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium mt-4 transition-colors"
          >
            Save EHR Integration
          </button>
        )}
      </div>
    </div>
  );
}
