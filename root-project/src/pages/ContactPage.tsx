import React, { useState, useEffect } from 'react';
import { Hero } from '../components/Hero/Hero';
import { extendedSettingsApi } from '../services/photoApi';
import type { ContactSettings } from '../services/photoApi';
import './ContactPage.css';

const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [settings, setSettings] = useState<ContactSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const contactSettings = await extendedSettingsApi.getContactSettings();
        setSettings(contactSettings);
      } catch (error) {
        console.error('Failed to load contact settings:', error);
      } finally {
        setIsLoadingSettings(false);
      }
    };
    loadSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to send message' }));
        throw new Error(error.error || 'Failed to send message');
      }

      // Success
      setSubmitStatus('success');
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });

      // Reset success message after 5 seconds
      setTimeout(() => setSubmitStatus('idle'), 5000);

    } catch (error) {
      console.error('Contact form error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Hero
        imageUrl={settings?.heroImageUrl || undefined}
        title={settings?.title || 'Get In Touch'}
        subtitle={settings?.subtitle || "Let's create something beautiful together"}
        isLoading={isLoadingSettings}
        fitImageToContainer={settings?.fitImageToContainer || false}
      />

      <div className="contact-container">
        <div className="contact-content">
          <section className="contact-info">
            <h2 className="contact-heading">Let's Talk</h2>
            <p className="contact-text">
              I'm always excited to hear about new projects and opportunities.
              Whether you have a question, want to book a session, or just want
              to say hello, feel free to reach out.
            </p>
            <p className="contact-text">
              I typically respond within 24-48 hours. Looking forward to connecting with you!
            </p>

            <div className="contact-details">
              <div className="contact-detail-item">
                <h3 className="contact-detail-label">Email</h3>
                <p className="contact-detail-value">hello@example.com</p>
              </div>
              <div className="contact-detail-item">
                <h3 className="contact-detail-label">Location</h3>
                <p className="contact-detail-value">Available for travel worldwide</p>
              </div>
            </div>
          </section>

          <section className="contact-form-section">
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name" className="form-label">
                  Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  className="form-input"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Your name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="form-input"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="your.email@example.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="subject" className="form-label">
                  Subject *
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  className="form-input"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  placeholder="What's this about?"
                />
              </div>

              <div className="form-group">
                <label htmlFor="message" className="form-label">
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  className="form-textarea"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  placeholder="Tell me about your project or inquiry..."
                />
              </div>

              {submitStatus === 'success' && (
                <div className="form-success">
                  Message sent successfully! I'll get back to you soon.
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="form-error">
                  Something went wrong. Please try again or email me directly.
                </div>
              )}

              <button
                type="submit"
                className="form-submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>

              <p className="form-note">
                * Required fields
              </p>
            </form>
          </section>
        </div>
      </div>
    </>
  );
};

export default ContactPage;
