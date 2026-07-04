const mongoose = require('mongoose');
const Blog = require('../models/Blog');

const cleanupDollarSigns = async () => {
  try {
    console.log('Starting cleanup of $1 from blogs...');
    
    // Update all blogs: remove $1 from title, description, and content
    const result = await Blog.updateMany(
      {
        $or: [
          { title: /\$1/ },
          { description: /\$1/ },
          { content: /\$1/ }
        ]
      },
      [
        {
          $set: {
            title: { $replaceAll: { input: '$title', find: '$1', replacement: '' } },
            description: { $replaceAll: { input: '$description', find: '$1', replacement: '' } },
            content: { $replaceAll: { input: '$content', find: '$1', replacement: '' } }
          }
        }
      ]
    );

    console.log(`Cleanup complete!`);
    console.log(`Modified ${result.modifiedCount} blog(s)`);
    
    if (result.modifiedCount > 0) {
      console.log('✅ All instances of $1 have been removed from blogs');
    } else {
      console.log('ℹ️  No blogs containing $1 were found');
    }

    return result;
  } catch (error) {
    console.error('Error during cleanup:', error);
    throw error;
  }
};

module.exports = cleanupDollarSigns;
