import { supabase } from '../lib/supabase';

export const taskService = {
  async getTasksForFacility(facilityId, filters = {}) {
    let query = supabase
      .from('milestone_tasks')
      .select(`
        *,
        milestone:milestones(id, name, status),
        assigned_user:user_roles!milestone_tasks_assigned_to_fkey(
          id,
          email,
          full_name
        ),
        created_user:user_roles!milestone_tasks_created_by_fkey(
          id,
          email,
          full_name
        )
      `)
      .eq('facility_id', facilityId)
      .order('created_at', { ascending: false });

    if (filters.milestoneId) {
      query = query.eq('milestone_id', filters.milestoneId);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }

    return data;
  },

  async getTaskById(taskId) {
    const { data, error } = await supabase
      .from('milestone_tasks')
      .select(`
        *,
        milestone:milestones(id, name, status),
        assigned_user:user_roles!milestone_tasks_assigned_to_fkey(
          id,
          email,
          full_name
        ),
        created_user:user_roles!milestone_tasks_created_by_fkey(
          id,
          email,
          full_name
        )
      `)
      .eq('id', taskId)
      .single();

    if (error) {
      console.error('Error fetching task:', error);
      throw error;
    }

    return data;
  },

  async createTask(taskData) {
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', (await supabase.auth.getUser()).data.user.id)
      .single();

    const { data, error } = await supabase
      .from('milestone_tasks')
      .insert({
        ...taskData,
        created_by: userRole.id
      })
      .select(`
        *,
        milestone:milestones(id, name, status),
        assigned_user:user_roles!milestone_tasks_assigned_to_fkey(
          id,
          email,
          full_name
        ),
        created_user:user_roles!milestone_tasks_created_by_fkey(
          id,
          email,
          full_name
        )
      `)
      .single();

    if (error) {
      console.error('Error creating task:', error);
      throw error;
    }

    return data;
  },

  async updateTask(taskId, updates) {
    const { data, error } = await supabase
      .from('milestone_tasks')
      .update(updates)
      .eq('id', taskId)
      .select(`
        *,
        milestone:milestones(id, name, status),
        assigned_user:user_roles!milestone_tasks_assigned_to_fkey(
          id,
          email,
          full_name
        ),
        created_user:user_roles!milestone_tasks_created_by_fkey(
          id,
          email,
          full_name
        )
      `)
      .single();

    if (error) {
      console.error('Error updating task:', error);
      throw error;
    }

    return data;
  },

  async deleteTask(taskId) {
    const { error } = await supabase
      .from('milestone_tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  },

  async getCommentsForTask(taskId) {
    const { data, error } = await supabase
      .from('task_comments')
      .select(`
        *,
        user:user_roles(
          id,
          email,
          full_name
        )
      `)
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      throw error;
    }

    return data;
  },

  async addComment(taskId, comment) {
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', (await supabase.auth.getUser()).data.user.id)
      .single();

    const { data, error } = await supabase
      .from('task_comments')
      .insert({
        task_id: taskId,
        user_id: userRole.id,
        comment
      })
      .select(`
        *,
        user:user_roles(
          id,
          email,
          full_name
        )
      `)
      .single();

    if (error) {
      console.error('Error adding comment:', error);
      throw error;
    }

    return data;
  },

  async updateComment(commentId, comment) {
    const { data, error } = await supabase
      .from('task_comments')
      .update({ comment })
      .eq('id', commentId)
      .select(`
        *,
        user:user_roles(
          id,
          email,
          full_name
        )
      `)
      .single();

    if (error) {
      console.error('Error updating comment:', error);
      throw error;
    }

    return data;
  },

  async deleteComment(commentId) {
    const { error } = await supabase
      .from('task_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  }
};
